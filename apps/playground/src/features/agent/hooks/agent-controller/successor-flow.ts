/**
 * Successor runs (Retry, "Write the failed sections again", "Finish the rest"):
 * exactly the named sections, written in place into the same build record.
 */
import {
  type AiAgentRunResult,
  type AiBuildEvent,
  type AiBuildSectionLanding,
  applyAiPlan,
  classifyAiRunFailure,
  pixiSkillIdsFor,
  runAiAgent,
} from '@craftkit/builder';

import { buildEndAnnouncement } from '../../model/agent-status';
import {
  type BuildProgress,
  type BuildTask,
  landedCount,
  lastEvidenceAt,
  reduceBuildProgress,
  withWriters,
} from '../../model/build-progress';
import { reduceRunTelemetry } from '../../model/run-telemetry';
import { preflightPorts } from '../../model/runs';
import {
  FILL_SKILL_ID,
  guardSection,
  reopenForSuccessor,
  sectionLabel,
  sectionValues,
  successorBrief,
  successorCompletedEvent,
  taskCompletedEvent,
  taskSkippedEvent,
  taskStartedEvent,
} from '../../model/successor-fill';
import type { Turn } from '../../model/turns';

import type { Flow } from './controller-state';
import { followKernel, kernelOfBuild } from './kernel-follow';
import { claim, holds, release, setRun } from './run-lease';
import { commonRunOptions } from './run-options';
import { say } from './run-outcomes';
import { locateTurn, patchKind, patchTurn } from './turn-plumbing';

/* ── Successor runs: exactly the named sections, in place ────────────────────── */

interface Written {
  readonly task: BuildTask;
  readonly result?: AiAgentRunResult | undefined;
  readonly error?: unknown;
}

export async function runSuccessor(
  flow: Flow,
  turnId: string,
  keys: readonly string[],
): Promise<void> {
  const env = flow.env();
  const located = locateTurn(flow, turnId);
  if (located?.turn.kind !== 'build' || keys.length === 0) return;
  const original = located.turn;
  const kernel = kernelOfBuild(flow, turnId);
  const wanted = new Set(keys);
  const document = kernel.getDocument();
  // Only sections whose region is still on the page can be written into.
  const tasks = original.progress.tasks.filter(
    (task) =>
      wanted.has(task.id) && task.status !== 'landed' && document.nodes[task.id] !== undefined,
  );
  if (tasks.length === 0) return;
  const slot = claim(flow, located.sessionId, turnId, 'build');
  if (slot === null) return;
  followKernel(flow, kernel);
  const startedAt = flow.clock.now();
  const priorElapsedMs =
    original.progress.report?.elapsedMs ??
    Math.max(0, lastEvidenceAt(original.progress) - original.progress.startedAt);
  const writers = Math.min(tasks.length, flow.ui.getState().workers);
  const reopened = withWriters(
    reopenForSuccessor(original.progress, new Set(tasks.map((task) => task.id)), startedAt),
    writers,
  );
  const {
    revived: _revived,
    undone: _undone,
    failure: _failure,
    stopping: _stopping,
    ...rest
  } = original;
  void _revived;
  void _undone;
  void _failure;
  void _stopping;
  patchTurn(flow, slot.sessionId, turnId, (): Turn => ({
    ...rest,
    progress: reopened,
    status: 'running',
  }));
  env.mood.beginRun(slot.runId, '');
  say(flow, 'build.started');
  let seq = 0;
  const feed = (event: AiBuildEvent, scope?: string): void => {
    if (!holds(flow, slot)) return;
    patchKind(flow, slot.sessionId, turnId, 'build', (turn) => {
      // Row identity belongs to the original build; physical attempt identity belongs
      // to this fresh lease so retried receipts cannot collide with old measurements.
      const logical = event.runId.startsWith(`${slot.runId}/fill-`)
        ? { ...event, runId: event.runId.replace(`${slot.runId}/`, `${original.progress.runId}/`) }
        : event;
      const progress = reduceBuildProgress(turn.progress, logical);
      const telemetry = reduceRunTelemetry(turn.telemetry, event, scope);
      return progress === turn.progress && telemetry === turn.telemetry
        ? turn
        : { ...turn, progress, telemetry };
    });
  };
  const progressNow = (): BuildProgress => {
    const turn = locateTurn(flow, turnId)?.turn;
    return turn?.kind === 'build' ? turn.progress : reopened;
  };
  const total = reopened.tasks.length;
  const hasFillSkill = env.registry.get(FILL_SKILL_ID) !== undefined;
  const landings = new Map<string, AiBuildSectionLanding>();
  const landedIds: string[] = [];

  /* Writers run a few at a time; sections still land one by one, in page order. */
  const write = async (task: BuildTask): Promise<Written> => {
    feed(taskStartedEvent(progressNow(), task, flow.clock.now(), (seq += 1)));
    const brief = successorBrief({
      direction: original.progress.direction,
      request: original.request,
      task,
      total,
      plan: original.pagePlan,
    });
    const base = commonRunOptions(flow, kernel, slot, brief, [task.id], undefined);
    const contract = original.pagePlan?.sections.find((section) => section.key === task.sectionKey);
    const creativeRequest = [
      task.title,
      contract?.purpose ?? '',
      ...(contract?.role === 'hero' || task.position === 1 ? [original.request] : []),
    ].join(' ');
    const selectedSkillIds = [
      ...(hasFillSkill ? [FILL_SKILL_ID] : []),
      ...pixiSkillIdsFor(env.registry, creativeRequest),
    ];
    try {
      const result = await runAiAgent({
        ...base,
        runId: `${slot.runId}/fill-${String(task.position)}`,
        isCurrentRun: () => flow.runtime.lease?.runId === slot.runId,
        ...(selectedSkillIds.length === 0 ? {} : { selectedSkillIds }),
        autoSkills: false,
        // The build's own writer policy: `setProp` only, its own region whole, the rest summarised.
        policy: { ...base.policy, allowedCommands: ['setProp'] },
        composition: { ...base.composition, documentTreeMode: 'scoped' },
        apply: 'never',
        onEvent: (event) => {
          env.options.onAgentEvent?.(event);
          feed(event, task.title);
        },
      });
      return { task, result };
    } catch (error: unknown) {
      return { task, error };
    }
  };
  const waiting = [...tasks];
  const pending = new Map<string, Promise<Written>>();
  const startNext = (): void => {
    while (pending.size < writers && waiting.length > 0 && holds(flow, slot)) {
      const next = waiting.shift();
      if (next !== undefined) pending.set(next.id, write(next));
    }
  };
  let stopped = false;
  try {
    startNext();
    for (const task of tasks) {
      const outcome = await pending.get(task.id);
      pending.delete(task.id);
      if (!holds(flow, slot)) {
        stopped = true;
        break;
      }
      startNext();
      if (outcome === undefined) continue;
      if (outcome.result === undefined) {
        const failure = classifyAiRunFailure(outcome.error);
        feed(
          taskSkippedEvent(
            progressNow(),
            task,
            {
              reason: failure.message,
              reasonCode: failure.source === 'provider' ? 'unreachable' : 'invalid',
            },
            flow.clock.now(),
            (seq += 1),
          ),
        );
        continue;
      }
      const guarded = guardSection(outcome.result.plan, task.id);
      if (guarded === null) {
        feed(
          taskSkippedEvent(
            progressNow(),
            task,
            {
              reason: `Section "${task.title}" wrote nothing inside its own region.`,
              reasonCode: 'out-of-scope',
            },
            flow.clock.now(),
            (seq += 1),
          ),
        );
        continue;
      }
      const before = sectionValues(kernel.getDocument(), task.id);
      try {
        const label = sectionLabel(task.position, total, task.title);
        const applied = applyAiPlan({
          kernel,
          validationPorts: preflightPorts(),
          plan: guarded.plan,
          policy: { allowedCommands: ['setProp'], maxCommands: guarded.plan.commands.length },
          label,
        });
        const tx = applied.transactions.at(-1);
        if (tx !== undefined) {
          landings.set(task.id, {
            transactionId: tx.id,
            label,
            before,
            after: sectionValues(kernel.getDocument(), task.id),
          });
          landedIds.push(tx.id);
        }
        feed(taskCompletedEvent(progressNow(), task, flow.clock.now(), (seq += 1)));
        const now = progressNow();
        env.live.landed(landedCount(now), now.tasks.length);
        setRun(flow, slot, { lastLanding: { title: task.title, at: flow.clock.now() } });
      } catch (cause: unknown) {
        feed(
          taskSkippedEvent(
            progressNow(),
            task,
            {
              reason:
                cause instanceof Error ? cause.message : 'The section was refused on landing.',
              reasonCode: 'page-changed',
            },
            flow.clock.now(),
            (seq += 1),
          ),
        );
      }
    }
    if (slot.controller.signal.aborted) stopped = true;
  } finally {
    // Whatever is still being written is dropped: nothing lands after Stop.
    const final = progressNow();
    const rows: BuildProgress = stopped
      ? {
          ...final,
          tasks: final.tasks.map((task) =>
            task.status === 'writing' || task.status === 'drafted' || task.status === 'waiting'
              ? { ...task, status: 'notWritten' as const }
              : task,
          ),
        }
      : final;
    const completed = successorCompletedEvent(rows, landings, {
      stopped,
      priorElapsedMs,
      elapsedMs: flow.clock.now() - startedAt,
      at: flow.clock.now(),
      seq: (seq += 1),
    });
    patchKind(flow, slot.sessionId, turnId, 'build', (turn) => ({
      ...turn,
      progress: reduceBuildProgress(rows, completed),
      status: 'settled',
      transactionIds: [...(turn.transactionIds ?? []), ...landedIds],
    }));
    const record = locateTurn(flow, turnId)?.turn;
    if (record?.kind === 'build') {
      const landed = landedCount(record.progress);
      const all = record.progress.tasks.length;
      const announcement = buildEndAnnouncement({
        phase: stopped ? 'stopped' : landed === all ? 'done' : 'partial',
        stopReason: 'signal',
        landed,
        total: all,
        skeleton: record.progress.tasks.some((task) => task.status !== 'landed'),
      });
      if (announcement !== null) say(flow, announcement.key, announcement.params);
    }
    env.mood.settleTurn(
      stopped
        ? { runId: slot.runId, outcome: 'stopped' }
        : { runId: slot.runId, outcome: 'plan', applied: true },
    );
    release(flow, slot);
  }
}
