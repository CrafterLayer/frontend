/**
 * The edit flow (`runAiAgent`): an edit or a new section, applied in Auto or proposed
 * in Ask, read as an answer when the model replied in words alone.
 */
import {
  type AiAgentRunResult,
  type BuilderDocument,
  type BuilderKernel,
  type IntentRoute,
  runAiAgent,
  type RunAiAgentOptions,
} from '@craftkit/builder';

import { editEndAnnouncement, runStartAnnouncement } from '../../model/agent-status';
import { blockName } from '../../model/block-name';
import { initialRunProgress, reduceRunProgress } from '../../model/run-progress';
import { reduceRunTelemetry } from '../../model/run-telemetry';
import { answerFromPlan, type Salvage, type Turn } from '../../model/turns';
import type { RunActivity } from '../../model/view-types';

import type { Flow } from './controller-state';
import {
  catalogFirst,
  recordingWords,
  spokeInWords,
  type WordsOnly,
  wordsSaid,
} from './edit-provider';
import {
  engineRequest,
  historyFor,
  markNotRun,
  openExchange,
  type Outgoing,
  type Placement,
} from './exchange';
import { followKernel } from './kernel-follow';
import { claim, release } from './run-lease';
import { commonRunOptions, editModelOptions, scriptRunOptions } from './run-options';
import { type Changes, compare, failureOf, failureTurn, rehearse, say } from './run-outcomes';
import { learnStoryBible } from './story-bible-context';
import { patchTurn } from './turn-plumbing';
import { targetOf } from './words-flow';

/* ── Edits ───────────────────────────────────────────────────────────────────── */

/**
 * The section a zero-token direct edit wrote, as the record's target, when the person
 * named no block and every change sits in that one section. Without it the record reads
 * «عُدِّلت الصفحة» for an edit that changed one heading. Empty when the person's own chip
 * names the target, or when the edit was a model's.
 */
function directTarget(
  kernel: BuilderKernel,
  result: Pick<AiAgentRunResult, 'directEdit'>,
  chosen: string | undefined,
): { readonly target?: string; readonly targetNodeId?: string } {
  const direct = result.directEdit?.target;
  if (chosen !== undefined || direct === undefined) return {};
  if (!direct.changes.every((change) => change.sectionId === direct.sectionId)) return {};
  if (kernel.getDocument().nodes[direct.sectionId] === undefined) return {};
  const name = direct.sectionName?.trim();
  return {
    target: name === undefined || name === '' ? blockName(kernel, direct.sectionId) : name,
    targetNodeId: direct.sectionId,
  };
}

export async function runEdit(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  apply: 'auto' | 'never',
  route?: IntentRoute,
): Promise<void> {
  const env = flow.env();
  const kernel = env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const target = targetOf(outgoing);
  const activity: RunActivity = apply === 'auto' ? 'edit' : 'proposal';
  const slot = claim(flow, placement.sessionId, turnId, activity);
  if (slot === null) return;
  followKernel(flow, kernel);
  const request = engineRequest(outgoing);
  const startedAt = flow.clock.now();
  const run = initialRunProgress(apply, startedAt);
  const common = {
    id: turnId,
    request,
    ...(target.label === undefined ? {} : { target: target.label }),
    ...(target.id === undefined ? {} : { targetNodeId: target.id }),
  };
  const drafting: Turn =
    apply === 'auto'
      ? {
          ...common,
          kind: 'edit',
          origin: 'request',
          status: 'running',
          mode: 'auto',
          run,
          changes: [],
        }
      : { ...common, kind: 'proposal', status: 'drafting', mode: 'ask', run, changes: [] };
  const anchor = openExchange(flow, placement, outgoing, drafting);
  env.mood.beginRun(slot.runId, target.label ?? '');
  const start = runStartAnnouncement(
    activity === 'edit'
      ? { activity: 'edit', target: target.label ?? null }
      : { activity: 'proposal' },
  );
  if (start !== null) say(flow, start.key, start.params);
  const logBefore = kernel.transactions().length;
  const documentBefore = kernel.getDocument();
  // A checkpoint before an edit writes (a proposal writes nothing until it is applied).
  if (activity === 'edit') env.options.checkpoints?.before(turnId, request, documentBefore);
  let beforeApply: BuilderDocument | undefined;
  let salvaged: Salvage | undefined;
  let proposed: Changes | undefined;
  const liveRun = (turn: Turn) =>
    (turn.kind === 'edit' || turn.kind === 'proposal') && turn.run !== undefined ? turn.run : run;
  let heard: (() => WordsOnly | null) | undefined;
  try {
    const base = commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history);
    // A catalog example picked by name is answered from the catalog: no model, no wait.
    const recording = recordingWords(
      outgoing.catalog === true ? catalogFirst(kernel, base.provider) : base.provider,
    );
    heard = recording.words;
    const runOptions: RunAiAgentOptions = {
      ...base,
      provider: recording.provider,
      ...editModelOptions(flow),
      // script-wiring additions
      ...scriptRunOptions(kernel),
      // end script-wiring additions
      // The route this request was sent on: the engine does not read the words twice.
      ...(route === undefined ? {} : { intent: route }),
      apply,
      onEvent: (event) => {
        env.mood.onEvent(event);
        env.options.onAgentEvent?.(event);
        if (event.type === 'plan.salvaged') salvaged = { kept: event.kept, dropped: event.dropped };
        if (event.type === 'plan.proposed' && apply === 'never') {
          proposed = rehearse(flow, kernel, event.proposal);
        }
        if (event.type === 'plan.applying') beforeApply = kernel.getDocument();
        patchTurn(flow, slot.sessionId, turnId, (turn) => {
          if ((turn.kind !== 'edit' && turn.kind !== 'proposal') || turn.run === undefined)
            return turn;
          const next = reduceRunProgress(turn.run, event);
          const telemetry = reduceRunTelemetry(turn.telemetry, event, target.label);
          return next === turn.run && telemetry === turn.telemetry
            ? turn
            : { ...turn, run: next, telemetry };
        });
      },
    };
    const result: AiAgentRunResult = await runAiAgent(runOptions);
    const endedAt = flow.clock.now();
    const plan = result.plan;
    const shared = {
      ...(plan.followUp === undefined ? {} : { followUp: plan.followUp }),
      ...(salvaged === undefined ? {} : { salvaged }),
      skills: result.proposal.skillActivations,
    };
    /*
      Words and no command (most often the model asking what was meant): an answer, not
      an edit that "already matched what you asked for" (`answerFromPlan`). Only when
      nothing landed and nothing was salvaged away: a plan whose commands were all
      dropped would describe changes that never happened.
    */
    const words =
      salvaged === undefined && kernel.transactions().length === logBefore
        ? answerFromPlan({ id: turnId, request, plan, skills: result.proposal.skillActivations })
        : null;
    if (words !== null) {
      patchTurn(flow, slot.sessionId, turnId, () => words);
      say(flow, 'answer.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    } else if (result.status === 'applied') {
      env.memory.note(result.proposal);
      learnStoryBible(env, kernel);
      const ids = kernel
        .transactions()
        .slice(logBefore)
        .filter((tx) => tx.author === 'ai')
        .map((tx) => tx.id);
      const transactionId = ids.at(-1);
      // What the one transaction did (a direct edit too, which proposes nothing to rehearse).
      const changes = compare(flow, kernel, beforeApply ?? documentBefore, kernel.getDocument());
      const status = transactionId !== undefined && !changes.empty ? 'done' : 'noChange';
      // A zero-token edit knows the one section it wrote: the record names it (SPEC §3.6).
      const named = directTarget(kernel, result, target.label);
      patchTurn(flow, slot.sessionId, turnId, (turn): Turn => ({
        ...common,
        ...named,
        kind: 'edit',
        origin: 'request',
        status,
        mode: 'auto',
        run: liveRun(turn),
        elapsedMs: endedAt - startedAt,
        changes: changes.lines,
        summary: plan.rationale,
        ...(transactionId === undefined || status === 'noChange' ? {} : { transactionId }),
        ...shared,
      }));
      const end = editEndAnnouncement({ status, target: named.target ?? target.label ?? null });
      say(flow, end.key, end.params);
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: true });
    } else {
      const touched = kernel.transactions().length > logBefore;
      const changes = proposed ?? rehearse(flow, kernel, result.proposal);
      patchTurn(flow, slot.sessionId, turnId, (turn): Turn => ({
        ...common,
        kind: 'proposal',
        status: 'ready',
        mode: 'ask',
        plan,
        proposal: result.proposal,
        changes: changes.lines,
        run: liveRun(turn),
        elapsedMs: endedAt - startedAt,
        ...(touched ? { pageTouched: true } : {}),
        ...shared,
      }));
      say(flow, 'proposal.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    }
  } catch (cause: unknown) {
    const endedAt = flow.clock.now();
    if (slot.controller.signal.aborted) {
      if (apply === 'auto') {
        patchTurn(flow, slot.sessionId, turnId, (turn): Turn => ({
          ...common,
          kind: 'edit',
          origin: 'request',
          status: 'stopped',
          mode: 'auto',
          run: liveRun(turn),
          elapsedMs: endedAt - startedAt,
          changes: [],
        }));
      } else {
        patchTurn(flow, slot.sessionId, turnId, () => ({
          id: turnId,
          kind: 'end',
          key: 'stoppedBeforeChange',
        }));
        markNotRun(flow, slot.sessionId, anchor);
      }
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    } else if (spokeInWords(cause, heard, kernel, logBefore)) {
      // The model answered in words (most often asking what was meant): its answer.
      const said = wordsSaid(cause, heard);
      const words = said === null ? null : answerFromPlan({ id: turnId, request, plan: said });
      if (words !== null) patchTurn(flow, slot.sessionId, turnId, () => words);
      say(flow, 'answer.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    } else {
      const failure = failureOf(cause);
      patchTurn(flow, slot.sessionId, turnId, () =>
        failureTurn(turnId, request, cause, { kind: 'unchanged' }, endedAt - startedAt),
      );
      say(flow, 'failed');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
    }
  } finally {
    release(flow, slot);
  }
}
