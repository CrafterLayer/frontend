import type { AiBuildOwnEvent } from '@craftkit/builder';

import type { RunRecord, RunUnitRecord } from './run-record';

/**
 * How a run journal record moves, one build event at a time. Pure: the journal
 * (`run-journal.ts`) owns storage and the clock; the record's shape and its readers are
 * `run-record.ts`'s.
 */

/**
 * The planned list's units. A unit `build.planned` names AGAIN (same region id) keeps
 * what it already did: a section that landed is still on the page, whatever the list.
 */
function unitsFromPlanned(
  tasks: readonly { id: string; title: string }[],
  known: readonly RunUnitRecord[],
): RunUnitRecord[] {
  const byId = new Map(known.map((unit) => [unit.id, unit]));
  return tasks.map((task, index) => {
    const position = index + 1;
    const before = byId.get(task.id);
    return before === undefined
      ? { position, id: task.id, title: task.title, status: 'waiting' as const, attempts: 0 }
      : { ...before, position, title: task.title };
  });
}

/** Replace one unit by POSITION, leaving the rest exactly as they were. */
function withUnit(
  units: readonly RunUnitRecord[],
  position: number,
  change: (unit: RunUnitRecord) => RunUnitRecord,
): readonly RunUnitRecord[] {
  return units.map((unit) => (unit.position === position ? change(unit) : unit));
}

/** The record without its streamed outline: the scaffold build lays sections of its own. */
function withoutOutline(record: RunRecord): RunRecord {
  if (record.outline === undefined) return record;
  const { outline: _outline, ...rest } = record;
  void _outline;
  return rest;
}

/** Apply one event to a record. Pure: the caller owns storage and the clock. */
export function reduceRunRecord(record: RunRecord, event: AiBuildOwnEvent): RunRecord {
  switch (event.type) {
    case 'build.scaffolding':
      /*
        The second `build.scaffolding` (the plan path gave out) takes the provisional
        regions back, and every section that landed early went with them: the scaffold
        build starts its unit table over.
      */
      return 'fallback' in event
        ? { ...withoutOutline(record), stage: 'scaffolding', units: [] }
        : { ...record, stage: 'scaffolding' };

    case 'build.skipped':
      /*
        NOT terminal, and not a failure — both of which this arm got wrong.

        `build.skipped` is emitted BEFORE the fallback run starts, and that run
        is a SUCCESS path: one ordinary agent writes the whole page. Marking the
        record `stopped` here froze it minutes before the work finished, and
        every later checkpoint then described a run the journal had already
        buried. And the skeleton's explanation is not a failure — it went into
        `failure`, a field documented as set only by `fail`, leaving a
        successful build carrying a failure sentence forever.

        So: keep the reason as the OUTCOME, stay running, and let the caller
        close it from the result like every other silent shape.
      */
      return { ...record, outcome: 'fallback', fallbackReason: event.reason };

    case 'build.outline':
      /*
        Cumulative and in page order: the newest outline is the whole list, so it
        replaces the last one. Kept after `build.planned` too (a brief closing re-sends
        it): it is the only place the plan's section KEYS are said while it streams.
      */
      return {
        ...record,
        outline: event.sections.map(({ key, title }) => ({ key, title })),
      };

    case 'build.planned':
      /*
        The mandatory first checkpoint that has a unit table at all, and the
        only event carrying real node ids. It also proves the skeleton landed,
        which is why the stage passes through `scaffolded` conceptually and
        arrives here.
      */
      return {
        ...record,
        stage: 'planned',
        direction: event.direction,
        units: unitsFromPlanned(event.tasks, record.units),
      };

    case 'task.started':
      /*
        Fires once per ATTEMPT, not once per unit — the writer loops over two
        attempts and emits inside the loop. So `startedAt` is set once and kept:
        resetting it on a retry would report the unit as younger than it is.
      */
      return {
        ...record,
        units: withUnit(record.units, event.position, (unit) => ({
          ...unit,
          status: 'running',
          attempts: event.attempt,
          startedAt: unit.startedAt ?? event.at,
        })),
      };

    case 'task.completed':
      return {
        ...record,
        units: withUnit(record.units, event.position, (unit) => ({
          ...unit,
          status: 'applied',
          attempts: event.attempts,
          settledAt: event.at,
          ...(event.transactionId === undefined ? {} : { transactionId: event.transactionId }),
          ...(event.label === undefined ? {} : { label: event.label }),
        })),
      };

    case 'task.skipped':
      return {
        ...record,
        units: withUnit(record.units, event.position, (unit) => ({
          ...unit,
          status: 'skipped',
          attempts: event.attempts,
          reason: event.reason,
          settledAt: event.at,
        })),
      };

    case 'build.stopped':
      /*
        NOT terminal, and the unit table is NOT frozen here. `halt()` settles
        only the unclaimed slots; sections already being written keep landing,
        so up to `fillConcurrency` more `task.completed` events arrive after
        this one. Freezing here would lose them, and a resume computed at this
        moment would re-fill units that are about to succeed.
      */
      return { ...record, outcome: event.reason };

    case 'build.completed':
      /*
        The one place a `not-started` verdict exists. The lander pushes that
        report and continues without emitting anything, so a unit the run never
        reached has no event of its own — its reason lives only here.
      */
      return {
        ...record,
        status: event.outcome === 'completed' ? 'completed' : 'stopped',
        stage: 'settled',
        outcome: event.outcome,
        elapsedMs: event.elapsedMs,
        /*
          A run that reaches here is alive, whatever a sweep decided while it was
          quiet. Taking the verdict back is the point of keeping it in its own
          field: a record cannot be both finished and abandoned.
        */
        recovered: false,
        units: event.tasks.map((report, index) => {
          /*
            The verdicts are the report's; the TIMES are the stream's.

            An earlier version stamped `settledAt: event.at` on every unit, which
            replaced each section's real landing time with the build's own last
            moment and invented one for sections that never started. The report
            says WHAT happened; only `task.completed` / `task.skipped` know when.
          */
          const known = record.units[index];
          const settledAt =
            known?.settledAt ?? (report.status === 'not-started' ? undefined : event.at);
          const transactionId = report.landing?.transactionId ?? known?.transactionId;
          const label = report.landing?.label ?? known?.label;
          return {
            position: index + 1,
            id: report.id,
            title: report.title,
            status: report.status,
            attempts: report.attempts,
            ...(report.reason === undefined ? {} : { reason: report.reason }),
            ...(known?.startedAt === undefined ? {} : { startedAt: known.startedAt }),
            ...(settledAt === undefined ? {} : { settledAt }),
            ...(report.sectionKey === undefined ? {} : { sectionKey: report.sectionKey }),
            ...(report.status !== 'applied' || transactionId === undefined
              ? {}
              : { transactionId, ...(label === undefined ? {} : { label }) }),
          };
        }),
      };

    /* v8 ignore next 2 -- every event type above is handled; this is the guard. */
    default:
      return record;
  }
}
