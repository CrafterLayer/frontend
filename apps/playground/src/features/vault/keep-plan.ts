import {
  canonicalJsonStringify,
  sha256Hex,
  type BuilderKernel,
  type NodeId,
} from '@craftkit/builder';

import { commitDraft, type CommitRefusal } from './commit-draft';
import { fingerprintDocument } from './drafts';
import type { RunRecord, RunUnitRecord } from './run-journal';

/**
 * Keep what succeeded, and take back what did not.
 *
 * ## The shell this exists to remove
 *
 * The scaffold inserts every section EMPTY — a `customCode` node holding a
 * label and a tree that is nothing but a `<section>`, a wrapper and an `<h2>`
 * with the title in it. A later run fills each one, by exactly one `setProp`
 * on that region's `tree`. When a fill never lands, today the placeholder
 * STAYS: `runAiBuild` says so twice, "left as the placeholder the scaffold laid
 * down; the page keeps its shape". This task is the reversal of that sentence —
 * a page that shipped four real sections and three empty headings is not a page
 * that mostly worked.
 *
 * ## Why `status !== 'applied'` is exact, not a guess
 *
 * Nothing but a unit's own fill can ever write over its placeholder: a fill run
 * is scoped to one region id and allowed one command. So a unit that did not
 * reach `applied` is one whose node still holds precisely the tree the scaffold
 * wrote. There is no "does this look empty" heuristic here, and there must not
 * be one — the journal already knows.
 *
 * ## What it is not
 *
 * It does not change `commitDraft`. The prune happens in the DRAFT, through the
 * kernel's own `removeNode`, and the live page still sees exactly one grouped
 * dispatch. `commitDraft` keeps its four refusals and its zero-writes promise
 * untouched; this is a layer above it, not a fork of it.
 */

/** Why a unit was not applied. `interrupted` is the torn tab, which has no reason. */
export type KeepCause = 'skipped' | 'not-started' | 'interrupted';

export interface KeepUnit {
  readonly position: number;
  readonly title: string;
  /** The scaffold's region. Absent only for a unit whose node was never created. */
  readonly shell?: NodeId;
  readonly keep: boolean;
  /** Why it is being dropped. Absent for a kept unit. */
  readonly cause?: KeepCause;
  /**
   * The door's own sentence, when the run produced one.
   *
   * FR-094 says every unit not applied must be NAMED and the reason given. A
   * torn tab produces no sentence — nobody was there to write one — so this is
   * optional and the card says "interrupted" instead of inventing prose.
   */
  readonly reason?: string;
}

export interface KeepPlan {
  readonly runId: string;
  /** The live document this plan was computed against; the commit re-checks it. */
  readonly baseFingerprint: string;
  /** Every unit, in page order, kept or not. */
  readonly units: readonly KeepUnit[];
  /**
   * The token a partial commit must echo back, or absent when nothing is dropped.
   *
   * A hash of exactly what is being dropped, not of the whole plan — so
   * recomputing the plan over an unchanged failure set yields the same token,
   * and a DIFFERENT failure set yields a different one. That is the whole point:
   * a boolean proves the caller typed `true`, this proves they saw the losses
   * they are agreeing to.
   */
  readonly acknowledgement?: string;
}

/** The units this plan is dropping, in page order. What FR-094 says must be named. */
export function notApplied(plan: KeepPlan): readonly KeepUnit[] {
  return plan.units.filter((unit) => !unit.keep);
}

/** The units this plan is keeping. Empty means there is nothing worth committing. */
export function kept(plan: KeepPlan): readonly KeepUnit[] {
  return plan.units.filter((unit) => unit.keep);
}

function causeOf(status: RunUnitRecord['status']): KeepCause {
  if (status === 'skipped') return 'skipped';
  /*
    `waiting` and `running` are both the torn tab: a unit the lander never
    reached, or one killed mid-write. Neither has a sentence, because no code
    path was alive to write one.
  */
  if (status === 'not-started') return 'not-started';
  return 'interrupted';
}

/**
 * The token, over the losses alone.
 *
 * Position, cause and reason — not titles, which a re-run could re-order, and
 * not the kept units, which are not what the person is being asked to accept.
 */
function acknowledgementFor(dropped: readonly KeepUnit[]): string | undefined {
  if (dropped.length === 0) return undefined;
  const projection = dropped.map((unit) => ({
    position: unit.position,
    cause: unit.cause,
    reason: unit.reason,
  }));
  return `keep-v1-sha256-${sha256Hex(canonicalJsonStringify(projection))}`;
}

/** What a keep would do, computed from the journal and nothing else. */
export function keepSucceeded(record: RunRecord): KeepPlan {
  const units: KeepUnit[] = record.units.map((unit) => {
    const keep = unit.status === 'applied';
    return {
      position: unit.position,
      title: unit.title,
      ...(unit.id === '' ? {} : { shell: unit.id }),
      keep,
      ...(keep ? {} : { cause: causeOf(unit.status) }),
      ...(keep || unit.reason === undefined ? {} : { reason: unit.reason }),
    };
  });
  const acknowledgement = acknowledgementFor(units.filter((unit) => !unit.keep));
  return {
    runId: record.runId,
    baseFingerprint: record.baseFingerprint,
    units,
    ...(acknowledgement === undefined ? {} : { acknowledgement }),
  };
}

export type KeepRefusal = CommitRefusal | 'unacknowledged' | 'nothing-kept';

export type KeepOutcome =
  | { readonly ok: true; readonly patches: number; readonly removed: number }
  | { readonly ok: false; readonly refusal: KeepRefusal; readonly reason: string };

export interface CommitKeptOptions {
  readonly live: BuilderKernel;
  /**
   * The draft KERNEL, not its document.
   *
   * The shells are pruned through the draft's own door, which is what makes the
   * prune reversible: `dispatchGroup` is atomic and one `undo()` puts it back.
   * Handing a document instead would mean editing `nodes` by hand and
   * reimplementing the slot bookkeeping `removeNode` already does — and getting
   * it slightly wrong produces a dangling child that `commitDraft` refuses as
   * `invalid`, which reads like a model problem and is not one.
   */
  readonly draft: BuilderKernel;
  readonly plan: KeepPlan;
  readonly label: string;
  /** Must equal `plan.acknowledgement`. Missing on a partial plan is a refusal. */
  readonly acknowledge?: string | undefined;
}

const PRUNE_LABEL = 'Keep what succeeded';

export function commitKept(options: CommitKeptOptions): KeepOutcome {
  const { live, draft, plan, label } = options;

  /*
    The acknowledgement is checked FIRST, before anything is read and long
    before anything is written. An unacknowledged partial must cost nothing at
    all — not a projection, and certainly not the draft's own shells.
  */
  if (plan.acknowledgement !== undefined && options.acknowledge !== plan.acknowledgement) {
    return {
      ok: false,
      refusal: 'unacknowledged',
      reason: 'Some sections were not written. Confirm what to drop before this is applied.',
    };
  }

  if (kept(plan).length === 0) {
    /*
      Its OWN refusal, and not a case `commitDraft` would have caught.

      A fully pruned draft is NOT identical to the pre-run page: the scaffold
      also wrote `pageCss` on the root. So `commitDraft` would have found one
      patch, seen a non-empty set, and cheerfully landed a stylesheet for a page
      with nothing on it.
    */
    return {
      ok: false,
      refusal: 'nothing-kept',
      reason: 'No section was written, so there is nothing to keep.',
    };
  }

  /*
    Staleness and the projection are re-checked here even though `commitDraft`
    checks both. They are free, and checking them first means a page that moved
    under the run never costs the draft its shells — the prune below is
    reversible, but not spending it at all is better than undoing it.
  */
  if (fingerprintDocument(live.getDocument()) !== plan.baseFingerprint) {
    return {
      ok: false,
      refusal: 'stale',
      reason: 'The page changed while this was building, so nothing was applied.',
    };
  }

  const shells = notApplied(plan)
    .map((unit) => unit.shell)
    .filter(
      (shell): shell is NodeId =>
        shell !== undefined && draft.getDocument().nodes[shell] !== undefined,
    );

  /*
    ONE group, deliberately. A single `undo()` restores it, and that is the
    property the recovery below rests on — split this into several dispatches
    and a late refusal would leave the draft half-pruned.
  */
  if (shells.length > 0) {
    draft.dispatchGroup(
      shells.map((shell) => ({ command: 'removeNode', args: { id: shell } })),
      { author: 'ai', label: PRUNE_LABEL },
    );
  }

  const outcome = commitDraft({
    live,
    draft: draft.getDocument(),
    baseFingerprint: plan.baseFingerprint,
    label,
  });

  if (!outcome.ok) {
    /*
      Load-bearing, not defensive. `invalid` and `unchanged` are only knowable
      AFTER the prune, and a refused keep must leave the draft exactly as it
      found it — otherwise a second attempt, or a Resume, works from a document
      that quietly lost its placeholders.
    */
    if (shells.length > 0) draft.undo();
    return outcome;
  }

  return { ok: true, patches: outcome.patches, removed: shells.length };
}
