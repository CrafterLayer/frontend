import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import {
  applyAiPlan,
  classifyAiRunFailure,
  ChromeButton,
  createCraftkitAiSkillRegistry,
  createLocalAiPlanProvider,
  outlineAiPlan,
  createMemoryContextProvider,
  GENERATION_STAGE_LABELS,
  GenerationProgress,
  previewAiPlan,
  runAiAgent,
  runAiBuild,
  StaticDocument,
  systemClock,
  systemIds,
  type AiAgentEvent,
  type AiAgentPolicy,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiChatTurn,
  type AiMemoryRecordV1,
  type AiPlan,
  type AiPlanProvider,
  type AiRunFailure,
  type AiSkillActivationPin,
  type AiSkillRegistry,
  type AiValidatedProposal,
  type BuilderDocument,
  type BuilderKernel,
  type GenerationStageId,
} from '@craftkit/builder';

import { AgentFace, AgentVoice, moodForTurn, useAgentMood, type AgentLocale } from '../AgentFace';
import {
  describeCost,
  describeImpact,
  estimateRequestTokens,
  planImpact,
  type PlanImpact,
} from './AssistantPanel.impact';
import { localeOf, panelSuggestions } from './AssistantPanel.suggestions';
import {
  IconAlert,
  IconCheck,
  IconChevron,
  IconClose,
  IconCode,
  IconEye,
  IconPlus,
  IconSend,
  IconShield,
  IconSparkle,
  IconStop,
  IconUndo,
} from './AssistantPanel.icons';
import {
  buildCount,
  buildEta,
  buildReceipt,
  initialBuildProgress,
  lastEvidenceAt,
  reduceBuildProgress,
  taskTransactionLabel,
  type BuildProgress,
  type BuildReceipt,
  type BuildTaskStatus,
} from './AssistantPanel.build';
import {
  initialRunProgress,
  liveStageElapsed,
  receiptOf,
  reduceRunProgress,
  stagesWithLiveClock,
  type RunProgress,
  type RunReceipt,
} from './AssistantPanel.progress';
import { describeStep, shortSkillFingerprint } from './AssistantPanel.utils';
import { catalogPolicyFor, type ProviderKind } from './catalogPolicyFor';
import { useFaceLook } from './use-face-look';

export interface AssistantPanelProps {
  kernel: BuilderKernel;
  /** Opens the code view on the proposal. Absent ⇒ the action is not offered. */
  onReviewAsCode?: (() => void) | undefined;
  /** Optional proposal source for an embedded or deterministic host. */
  planProvider?: AiPlanProvider | undefined;
  /**
   * What `planProvider` IS, declared by whoever wired it. Decides how much of
   * the block catalog each run sends: an offline provider scores schemas and
   * needs all of them; a remote model needs names. Defaults to `'offline'`,
   * which is also right for every test double that wraps the offline one —
   * inferring `'remote'` from the mere presence of a provider starved exactly
   * those doubles and was reverted.
   */
  providerKind?: ProviderKind | undefined;
  /** Host-owned, data-only expertise available to this assistant surface. */
  skillRegistry?: AiSkillRegistry | undefined;
  /** Explicit Skills to activate for every request on this surface. */
  selectedSkillIds?: readonly string[] | undefined;
  /** Optional host narrowing for commands, Skills, and context budgets. */
  agentPolicy?: Partial<AiAgentPolicy> | undefined;
  /** Ordered telemetry only; observer failures never acquire run authority. */
  onAgentEvent?: ((event: AiAgentEvent) => void) | undefined;
  /**
   * The split build's OWN events (`build.*`, `task.*`), when a request routes
   * to the orchestrator. Separate from `onAgentEvent` on purpose: every step of
   * a build is an ordinary run and still reports through that one, so a host
   * that only cares about runs needs no new code, and a host that wants to
   * watch the build itself does not have to filter a widened union.
   */
  onBuildEvent?: ((event: AiBuildOwnEvent) => void) | undefined;
  /**
   * localStorage key for reviving conversations across reloads. Absent ⇒ the
   * panel stays fully in-memory (the portable default: the engine never
   * assumes a browser store; the HOST opts in).
   */
  persistKey?: string | undefined;
  /**
   * The language of the character's one visible line (the panel's live
   * region). Default `'ar'`: the tool is called Assistant; the person inside
   * it is أبو غضب. Not an i18n layer — the chrome stays English because
   * everything it names is Latin. `'en'` exists so tests, Storybook a11y and
   * an English-speaking reviewer see the same persona deterministically.
   */
  locale?: AgentLocale | undefined;
  /**
   * Whether this panel is the destination a person is actually looking at.
   *
   * The host keeps the assistant MOUNTED across rail destinations, because its
   * unmount aborts the run in flight — so "not visible" and "not rendered" have
   * come apart, and the panel has to be told which it is. A hidden element
   * measures zero, so anything that reads geometry (the thread following the
   * newest turn) is a no-op while it is away and has to be redone on the way
   * back. Defaults to `true`: a panel nobody told is a panel on screen.
   */
  visible?: boolean | undefined;
}

/**
 * One turn. A plan belongs to its MESSAGE, not to a single "current plan" slot:
 * a person needs to see what was proposed three turns ago as readily as what
 * was proposed just now, and one slot forgets the moment you ask anything else.
 */
/**
 * A split build IN FLIGHT: the skeleton, then one row per section.
 *
 * It is its own turn kind rather than a variant of `thinking` because it
 * answers different questions — which section is open, how many are left, and
 * (in Ask) whether the person has approved the list at all — and because a
 * build that has already applied its skeleton must never be mistaken for a
 * request that has changed nothing yet.
 */
interface BuildingTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'building';
  /** The original request, kept so a skipped section can be re-asked. */
  readonly request: string;
  readonly progress: BuildProgress;
  /** Ask mode only: the one approval, still unanswered. */
  readonly awaiting?: boolean;
}

/** A finished build: the report, and what can still be undone from it. */
interface BuiltTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'built';
  readonly progress: BuildProgress;
  readonly receipt?: BuildReceipt;
  /** The person stopped it, or the budget did. */
  readonly stopped?: boolean;
  readonly request?: string;
  /**
   * Runtime-only, exactly like a plan's `proposal`: the kernel history this
   * report can undo through belongs to THIS session. A revived report is
   * readable and inert.
   */
  readonly undoable?: boolean;
  /** The lowest section position already undone; every later one went with it. */
  readonly undoneFrom?: number;
  /** How many kernel undos this card has already spent. */
  readonly undoneSteps?: number;
}

type Turn =
  | { readonly id: string; readonly from: 'you'; readonly text: string }
  | BuildingTurn
  | BuiltTurn
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'thinking';
      readonly subject: string;
      /** The provider's own last words about what it is doing, when it streams them. */
      readonly progress?: string;
      /** The run as rows — Plan, Structure and (Auto only) Apply. */
      readonly run: RunProgress;
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'stopped';
      /** How long it ran and where it was — a stop is an outcome, not a void. */
      readonly receipt?: RunReceipt;
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'refused';
      readonly text: string;
      readonly failure?: AiRunFailure;
      /** Kept only so a retryable failure can start a fresh, bounded run. */
      readonly request?: string;
      /** The row that was active when it broke, so the card can say where. */
      readonly failedAt?: GenerationStageId;
      /** How long it ran, where it broke, and the provider's last words. */
      readonly receipt?: RunReceipt;
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'discarded';
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      /**
       * A PLAN, in prose, with no commands behind it.
       *
       * A kind of its own rather than a `plan` turn with an empty command list,
       * because the card that renders a plan offers Preview — and Preview
       * offers Apply. A turn that has nothing to apply should not be able to
       * reach a button that applies: the strongest way to say that is to give
       * it a shape with no proposal in it at all.
       */
      readonly kind: 'outline';
      readonly text: string;
      readonly followUp?: string;
      readonly skills?: readonly AiSkillActivationPin[];
      /** Commands the model proposed anyway, and this run refused to keep. */
      readonly dropped: number;
      /** The settled run, for the timing receipt. */
      readonly run?: RunProgress;
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'plan';
      readonly plan: AiPlan;
      /**
       * What this plan would change, computed ONCE when it arrived.
       *
       * On the turn rather than in a render memo, because the honest source is
       * `previewAiPlan` — it builds a scratch kernel and dispatches the whole
       * plan through the real door. That is the right price to pay once per
       * proposal and the wrong one to pay per render, and `turns` changes on
       * every streamed progress tick. It is plain data, so it survives
       * persistence as readable history, unlike the proposal beside it.
       */
      readonly impact?: PlanImpact;
      /**
       * What the request cost to send, estimated with the engine's own
       * estimator over the context this run actually carried.
       *
       * Stored beside the impact for the same reason: the inputs (the assembled
       * context, the history) belong to the run and are gone by the next
       * render, so the number is computed once, when the answer arrives.
       */
      readonly costTokens?: number;
      /** Runtime-authenticated authority. It deliberately cannot survive JSON revival. */
      readonly proposal?: AiValidatedProposal;
      readonly skills?: readonly AiSkillActivationPin[];
      readonly applied: boolean;
      /** The mode this plan was proposed under; absent (revived old data) reads as 'ask'. */
      readonly mode?: AssistantMode;
      /** The settled run, for the timing receipt. */
      readonly run?: RunProgress;
    };

/**
 * How eagerly the assistant acts, the way Claude's own modes read:
 * Ask proposes and waits for Apply; Auto applies a validated plan immediately
 * (still one atomic, undoable change); Plan only ever plans — the card offers
 * Preview and discussion, never Apply.
 */
export type AssistantMode = 'ask' | 'auto' | 'plan';

const MODES: readonly { id: AssistantMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Ask', hint: 'Propose, then wait for Apply' },
  { id: 'auto', label: 'Auto', hint: 'Apply validated plans immediately' },
  { id: 'plan', label: 'Plan', hint: 'Only plan — never apply' },
];

const MENTION_PATTERN = /@([A-Za-z0-9_-]*)$/;
const MENTION_IDS = /@([A-Za-z0-9_-]+)/g;

interface Session {
  readonly id: string;
  readonly title: string;
  readonly turns: readonly Turn[];
}

interface ActiveRunLease {
  readonly runId: string;
  readonly controller: AbortController;
}

function ownsRun(activeRun: ActiveRunLease | null, runId: string): boolean {
  return activeRun !== null && activeRun.runId === runId;
}

/** Four openers, each a request that works exactly as written. */
/** The largest `-N` suffix among saved session and turn ids, so new ids never repeat one. */
function highestIdSuffix(sessions: readonly Session[]): number {
  let highest = 1;
  const consider = (id: string): void => {
    const match = /-(\d+)$/u.exec(id);
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]));
  };
  for (const session of sessions) {
    consider(session.id);
    for (const turn of session.turns) consider(turn.id);
  }
  return highest;
}

/**
 * The receipt on a settled card: every row that finished, with how long it
 * took — "Plan 00:01.123 · Structure 00:00.310". Nothing when the run left no
 * done row (a revived card, or a failure before the first row settled).
 */
function timingReceipt(run: RunProgress | undefined) {
  const done =
    run?.stages.filter((stage) => stage.status === 'done' && stage.detail !== undefined) ?? [];
  if (done.length === 0) return null;
  return (
    <p className="pg-chat__timing">
      {done
        .map((stage) => `${GENERATION_STAGE_LABELS[stage.id]} ${stage.detail ?? ''}`)
        .join(' · ')}
    </p>
  );
}

/**
 * One quiet line for an ending: how long the run took, how far it got, and —
 * when the provider streamed any — its own last words. No em dash without a
 * line to follow it, and no colour: a stop is not a failure, and a failure
 * already carries its own.
 */
function endingReceipt(verb: string, receipt: RunReceipt | undefined) {
  if (receipt === undefined) return null;
  return (
    <p className="pg-chat__receipt">
      {`${verb} after ${receipt.elapsed}`}
      {receipt.stageLabel === null ? '' : ` at ${receipt.stageLabel}`}
      {receipt.lastLine === undefined ? null : (
        <>
          {' — '}
          {/* Provider text: it declares its own direction, the chrome does not. */}
          <span dir="auto">{receipt.lastLine}</span>
        </>
      )}
    </p>
  );
}

/**
 * The three page ARCHETYPES a split build exists for.
 *
 * The panel does not re-implement the matcher: it asks the same registry the
 * run would, with the same `auto` resolution, and reads back which Skills the
 * request activated. A page-sized request is exactly the one that lands on one
 * of these, so the routing decision and the run's own expertise can never
 * disagree — and a host that swaps the registry gets a build only when its own
 * registry says so.
 */
const BUILD_ARCHETYPES: ReadonlySet<string> = new Set([
  'craftkit.page-composition',
  'craftkit.cv-page',
  'craftkit.occasion-page',
]);

function activatesBuildArchetype(registry: AiSkillRegistry, request: string): boolean {
  try {
    return registry
      .prepare({ request, auto: true })
      .activations.some((activation) => BUILD_ARCHETYPES.has(activation.id));
  } catch {
    // A registry that cannot resolve is a registry that cannot promise a
    // build. The ordinary path still works, so the request takes it.
    return false;
  }
}

/** The orchestrator's own events, told apart from every step's ordinary ones. */
function isBuildOwnEvent(event: AiBuildEvent): event is AiBuildOwnEvent {
  return event.type.startsWith('build.') || event.type.startsWith('task.');
}

/**
 * The conversation as context: what was asked and what the assistant answered,
 * oldest first, capped so an old chat cannot crowd out the document. Thinking
 * bubbles, stop markers and section lists carry no meaning here.
 */
function historyOf(turns: readonly Turn[]): AiChatTurn[] {
  return turns
    .flatMap<AiChatTurn>((turn) => {
      if (turn.from === 'you') {
        return [{ role: 'user', text: turn.text }];
      }
      if (turn.kind === 'plan') {
        return [{ role: 'assistant', text: turn.plan.rationale }];
      }
      if (turn.kind === 'outline') {
        /*
          The plan the assistant just wrote IS the answer, so it belongs in the
          history like any other. Dropping it meant a person could say "do
          option two" and the next request would arrive without the answer that
          had the options in it — the model being asked to remember something it
          was never told.
        */
        return [{ role: 'assistant', text: turn.text }];
      }
      if (turn.kind === 'refused') {
        return [{ role: 'assistant', text: turn.text }];
      }
      if (turn.kind === 'built') {
        return [{ role: 'assistant', text: turn.progress.direction }];
      }
      return [];
    })
    .slice(-12);
}

/**
 * Ask again for the sections a build gave up on — and ONLY those.
 *
 * Deliberately worded without any page noun: the routing above reads the same
 * registry, and a retry that said "landing page" again would scaffold a second
 * skeleton over the one already on the canvas.
 */
function retrySkippedRequest(titles: readonly string[]): string {
  return `Write the sections that were skipped: ${titles
    .map((title) => `“${title}”`)
    .join(
      ', ',
    )}. Keep the direction the rest of the page already follows, and change nothing else.`;
}

/** One section's state, in a person's words rather than the reducer's. */
const TASK_STATUS_LABEL: Readonly<Record<BuildTaskStatus, string>> = {
  waiting: 'Waiting',
  running: 'Working',
  applied: 'Done',
  skipped: 'Skipped',
};

/** The live clock's beat, and the point at which a stage is worth mentioning. */
const CLOCK_TICK_MS = 1_000;
const SLOW_STAGE_MS = 90_000;

interface LiveStageClockProps {
  /** The card's heading, and the region's accessible name. */
  readonly heading: string;
  /** The run as rows. Its active row is the one that ticks. */
  readonly run: RunProgress;
}

/**
 * The RUNNING clock on the active row.
 *
 * `GenerationProgress` is presentational and owns no timer (a replayed run and
 * a live one must render identically), and the reducer is pure — so the tick
 * lives here, in the smallest component that shows the number: one interval,
 * cleared the moment the run settles and on unmount, re-rendering this card
 * and nothing above it. A stage that settles keeps the reducer's exact detail;
 * only the open row counts up. Under `prefers-reduced-motion` nothing changes:
 * a clock is information, not motion.
 */
export function LiveStageClock({ heading, run }: LiveStageClockProps) {
  const since = run.stageSince;
  const [now, setNow] = useState(() => systemClock.now());
  useEffect(() => {
    // A settled run has no open row: nothing to count, so nothing is scheduled.
    if (since === null) {
      return;
    }
    /*
      No synchronous resync here: `liveStageElapsed` floors at zero, so a `now`
      left over from the previous row reads as 00:00 until the first tick —
      which is exactly what a row that just opened should show.
    */
    const ticker = window.setInterval(() => {
      setNow(systemClock.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(ticker);
    };
  }, [since]);
  const elapsed = liveStageElapsed(run, now);
  return (
    <>
      <GenerationProgress
        heading={heading}
        stages={stagesWithLiveClock(run, now)}
        announce={false}
      />
      {/* Slow is not wrong: muted words, never a warning colour. */}
      {elapsed !== null && elapsed >= SLOW_STAGE_MS ? (
        <p className="pg-chat__slow">Taking longer than usual.</p>
      ) : null}
    </>
  );
}

/** One name, chosen by locale. Never both: a bilingual header reads as two people. */
const AGENT_NAME = { ar: 'أبو غضب', en: 'Abu Ghadab' } as const satisfies Record<
  AgentLocale,
  string
>;

/*
  The four hardcoded English sentences that used to live here are gone.

  They were wrong three ways at once: English only, in a product whose default
  locale is Arabic; unrelated to the blocks this build actually registered; and
  shown ONLY before the first message, so a person who wrote one thing and
  paused was left with an empty box and a blinking cursor. Suggestions are now
  derived — see `AssistantPanel.suggestions.ts` — and they never run out.
*/

const EMPTY_TURNS: readonly Turn[] = [];

/** The built-in skill that makes a plan a plan, and makes it unable to write. */
const PLAN_MODE_SKILL_ID = 'craftkit.plan-mode';

/**
 * The skills a run carries, with Plan's own added when the person chose Plan.
 *
 * This is what made Plan indistinguishable from Ask: the two sent a request
 * that differed only by an `apply` flag, so the model was never told it was
 * planning and answered with whatever it would have answered anyway.
 *
 * Adding the id here does two things at once, and the second is the one that
 * matters. It gives the model the four-part shape to answer in — and, because
 * `craftkit.plan-mode` declares `restrictToCommands: []` and skill restrictions
 * INTERSECT, it leaves the run with no command it is allowed to emit at all.
 * "Plan never applies" stops being a flag a caller must remember.
 *
 * The host's own selection is preserved: a host that pinned skills still gets
 * them, with Plan's added, and never twice.
 */
function skillsForMode(
  mode: AssistantMode,
  selected: readonly string[] | undefined,
): readonly string[] | undefined {
  if (mode !== 'plan') return selected;
  const base = selected ?? [];
  return base.includes(PLAN_MODE_SKILL_ID) ? base : [...base, PLAN_MODE_SKILL_ID];
}

/**
 * The `followUp` of the NEWEST answer — and only if that answer had one.
 *
 * Stops at the first assistant turn found reading backwards, whatever kind it
 * is, rather than skipping past newer answers hunting for a plan. The first
 * version did skip, and the effect was a suggestion that outlived its
 * conversation: a plan proposed "now add pricing", the person then asked
 * something else and got a refusal or a report, and the strip still offered
 * "now add pricing" as though nothing had happened since.
 *
 * `thinking` turns are passed over on purpose — they are the spinner, not an
 * answer, and the strip must not go blank while the assistant is mid-sentence.
 */
function lastFollowUp(turns: readonly Turn[]): string | undefined {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.from !== 'assistant') continue;
    if (turn.kind === 'thinking') continue;
    if (turn.kind === 'plan') return turn.plan.followUp;
    /*
      An outline carries one too, and it is the one the plan skill is REQUIRED
      to produce — "what to say next" is half of what Plan mode was asked to
      fix. Reading only `plan` turns meant Plan's own follow-up was stored and
      then never shown, which is the same as not having it.
    */
    if (turn.kind === 'outline') return turn.followUp;
    return undefined;
  }
  return undefined;
}
const DEFAULT_AI_SKILL_REGISTRY = createCraftkitAiSkillRegistry();

/**
 * Fresh ports for every preflight.
 *
 * The dry run happens on a SCRATCH kernel and must not borrow the live one's id
 * source: a shared source would hand the rehearsal ids the real document then
 * claims, so the safety check would corrupt the thing it exists to protect.
 */
function preflightPorts() {
  return { clock: systemClock, ids: systemIds };
}

interface PersistedPanelState {
  readonly sessions: readonly Session[];
  readonly activeId: string;
  /**
   * The mode the person last chose.
   *
   * It was not saved, so every reload returned to Ask — and Ask can write. A
   * person who deliberately put the assistant in Plan came back to a panel that
   * would apply, having changed nothing and been told nothing. Revived
   * defensively: anything that is not one of the three reads as Ask, which is
   * also what data written before this field says.
   */
  readonly mode?: AssistantMode;
}

/**
 * Saved conversations from before ids continued across reloads can hold two
 * turns with one id. React keys must be unique, so the later twin is re-keyed
 * once, on revival; nothing else refers to a turn by id after it is settled.
 */
function withUniqueTurnIds(sessions: readonly Session[]): readonly Session[] {
  const seen = new Set<string>();
  let repaired = highestIdSuffix(sessions);
  return sessions.map((session) => ({
    ...session,
    turns: session.turns.map((turn) => {
      if (!seen.has(turn.id)) {
        seen.add(turn.id);
        return turn;
      }
      repaired += 1;
      const id = `turn-${String(repaired)}`;
      seen.add(id);
      return { ...turn, id };
    }),
  }));
}

/**
 * Revive a saved conversation, defensively: storage can be missing, blocked,
 * or stale. A turn saved mid-thought becomes 'stopped' — a reload killed that
 * request, and a spinner that nothing will ever resolve is a lie.
 */
function reviveSessions(persistKey: string | undefined): PersistedPanelState | null {
  if (persistKey === undefined) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(persistKey);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedPanelState;
    // Checked via a separate binding: Array.isArray on a readonly-array
    // property would narrow it to any[] and un-type every turn below.
    const sessionsShape: unknown = parsed.sessions;
    if (!Array.isArray(sessionsShape) || typeof parsed.activeId !== 'string') {
      return null;
    }
    const sessions = parsed.sessions.map((session) => ({
      ...session,
      turns: session.turns.map((turn): Turn => {
        if (turn.from === 'assistant' && turn.kind === 'thinking') {
          /*
            The run it left behind is plain data, so the stop can still say
            how far it got — measured to the last moment there is EVIDENCE
            for (when its open row began), never to now: the wall clock kept
            running while the tab was closed, the request did not. Saved data
            from before runs carried an origin yields no receipt at all rather
            than an invented one.
          */
          // Saved JSON, not a live turn: storage predating run receipts has no
          // `run` at all, so it is read through the shape it was written in.
          const { run } = turn as { readonly run?: RunProgress };
          const receipt =
            run === undefined
              ? null
              : receiptOf(run, run.stageSince ?? run.startedAt, turn.progress);
          return {
            id: turn.id,
            from: 'assistant',
            kind: 'stopped',
            ...(receipt === null ? {} : { receipt }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'building') {
          /*
            The same rule the thinking turn follows, for the same reason: the
            reload killed the build, so a list that still says "Working" is a
            lie. The sections it had already applied are on the page — they
            were real transactions — so the receipt reports them, measured to
            the last moment there is evidence for rather than to now.
          */
          // Saved JSON, not a live turn: read through the shape it was written in.
          const { progress } = turn as { readonly progress?: BuildProgress };
          const receipt =
            progress === undefined ? null : buildReceipt(progress, lastEvidenceAt(progress));
          return {
            id: turn.id,
            from: 'assistant',
            kind: 'built',
            progress: progress ?? initialBuildProgress(turn.id, Number.NaN),
            stopped: true,
            ...(receipt === null ? {} : { receipt }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'built') {
          /*
            A report is readable across a reload; its Undo is not. The kernel
            history it could walk belongs to the session that made it, and this
            one has none — so `undoable` is dropped exactly as a plan's
            `proposal` is.
          */
          return {
            id: turn.id,
            from: turn.from,
            kind: turn.kind,
            progress: turn.progress,
            ...(turn.receipt === undefined ? {} : { receipt: turn.receipt }),
            ...(turn.stopped === undefined ? {} : { stopped: turn.stopped }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'plan') {
          // A JSON clone does not carry the module-private authentication held
          // by a live proposal. Keep the conversation, never revive authority.
          return {
            id: turn.id,
            from: turn.from,
            kind: turn.kind,
            plan: turn.plan,
            applied: turn.applied,
            ...(turn.skills === undefined ? {} : { skills: turn.skills }),
            ...(turn.mode === undefined ? {} : { mode: turn.mode }),
          };
        }
        return turn;
      }),
    }));
    return {
      sessions: withUniqueTurnIds(sessions),
      activeId: parsed.activeId,
      // Passed through as READ. The caller decides what an unrecognised value
      // means, so one place owns the "unknown reads as Ask" rule.
      ...(parsed.mode === undefined ? {} : { mode: parsed.mode }),
    };
  } catch {
    return null;
  }
}

/**
 * The assistant, as a conversation.
 *
 * It never writes a document. It proposes kernel COMMANDS; they are dry-run on
 * a scratch kernel before anyone sees them; and applying them goes through the
 * same validated door every other edit uses — stamped `author: 'ai'`, so an
 * assistant edit is undoable and appears in the provenance strip beside the
 * ones a person made.
 *
 * The plan is SHOWN before it is applied. An assistant that changes the page
 * the instant you press Enter is a magic trick; one that says what it intends
 * and can be refused is a tool.
 */
export function AssistantPanel({
  kernel,
  onReviewAsCode,
  planProvider,
  providerKind = 'offline',
  skillRegistry,
  selectedSkillIds,
  agentPolicy,
  onAgentEvent,
  onBuildEvent,
  persistKey,
  locale = 'ar',
  visible = true,
}: AssistantPanelProps) {
  const [sessions, setSessions] = useState<readonly Session[]>(
    () =>
      reviveSessions(persistKey)?.sessions ?? [{ id: 'session-1', title: 'New chat', turns: [] }],
  );
  /*
    Ids continue from where the revived conversation stopped. A counter that
    restarted at 1 on every load handed a new turn the id of a saved one, and
    React then saw two children with the same key — a duplicated or dropped
    bubble, depending on the day.
  */
  const [idSeed] = useState(() => highestIdSuffix(sessions));
  const counter = useRef(idSeed);
  const nextId = useCallback((prefix: string) => {
    counter.current += 1;
    return `${prefix}-${String(counter.current)}`;
  }, []);
  const [activeId, setActiveId] = useState(
    () => reviveSessions(persistKey)?.activeId ?? 'session-1',
  );
  const [mode, setMode] = useState<AssistantMode>(() => {
    const saved = reviveSessions(persistKey)?.mode;
    // Anything unrecognised — older data, a hand-edited store — reads as Ask.
    return saved === 'auto' || saved === 'plan' ? saved : 'ask';
  });

  // Every settled change is written back; a blocked store fails silently — the
  // conversation still works, it just forgets on reload.
  useEffect(() => {
    if (persistKey === undefined) {
      return;
    }
    try {
      window.localStorage.setItem(persistKey, JSON.stringify({ sessions, activeId, mode }));
    } catch {
      // Storage full or blocked: in-memory behaviour continues unchanged.
    }
  }, [activeId, mode, persistKey, sessions]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** Whether the composer holds focus — the face listens when it does. */
  const [composerFocused, setComposerFocused] = useState(false);
  /*
    The character's mood: a pure function of the run log plus the composer.
    The hook owns one timer for its dwells and holds; the panel only tells it
    when a run begins, what the agent said, how the turn settled, and what
    the person did to a card.
  */
  const {
    snapshot: face,
    beginRun: beginFaceRun,
    onEvent: onFaceEvent,
    settleTurn: settleFaceTurn,
    noteTurn: noteFaceTurn,
    reset: resetFace,
  } = useAgentMood({ mode, composerFocused, draftLength: draft.length });
  // He watches you cross the header (or the empty state) — never while you type.
  const { watchZone: watchHeadZone, holdSeat: holdHeadSeat } = useFaceLook();
  const { watchZone: watchEmptyZone, holdSeat: holdEmptySeat } = useFaceLook();
  /** The @-mention in progress: the text typed after the trailing @, or null. */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  /** A lease and controller for the one run allowed to own this panel. */
  const activeRunRef = useRef<ActiveRunLease | null>(null);
  /**
   * The pending answer to a build's ONE question. A ref, not state: it is the
   * continuation of a promise the orchestrator is awaiting, and putting it in
   * state would re-render the panel to store something no view reads.
   */
  const approvalRef = useRef<((answer: 'build' | 'stop') => void) | null>(null);
  /**
   * WHAT WAS ACTUALLY BUILT: bounded, host-authored outcome data only. Model
   * rationale is conversation text, never durable trusted memory.
   */
  const [memory] = useState(() => {
    // A plain mutable list, owned by the closure — deliberately NOT state:
    // notes feed the next request's context, they never drive a render.
    const records: AiMemoryRecordV1[] = [];
    return {
      note: (proposal: AiValidatedProposal) => {
        const commandNames = [...new Set(proposal.plan.commands.map(({ command }) => command))];
        records.push({
          schemaVersion: 1,
          source: 'host',
          kind: 'applied-change',
          trust: 'reviewed',
          summary: `Applied ${String(proposal.plan.commands.length)} validated Builder command${proposal.plan.commands.length === 1 ? '' : 's'}.`,
          commandNames,
        });
        if (records.length > 20) {
          records.shift();
        }
      },
      hasRecords: () => records.length > 0,
      provider: createMemoryContextProvider({ load: () => [...records] }),
    };
  });
  const memoryProvider = memory.provider;
  /**
   * The open preview: the plan's turn id, the plan, and the WOULD-BE document
   * the scratch rehearsal produced. Looking never writes; Apply from here goes
   * through the same accept() as the card's own button.
   */
  const [preview, setPreview] = useState<{
    id: string;
    proposal: AiValidatedProposal;
    document: BuilderDocument;
  } | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const sessionsRef = useRef<HTMLDivElement | null>(null);
  const sessionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inputId = useId();
  const modeLockId = useId();
  const sessionsListId = useId();
  const subscribeToKernel = useCallback(
    (onStoreChange: () => void) => kernel.context.store.subscribe(onStoreChange),
    [kernel],
  );
  const getSelectionSnapshot = useCallback(
    () => kernel.context.store.getState().selection,
    [kernel],
  );
  const selectedIds = useSyncExternalStore(
    subscribeToKernel,
    getSelectionSnapshot,
    getSelectionSnapshot,
  );

  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];
  const turns = active?.turns ?? EMPTY_TURNS;

  const patchTurns = useCallback(
    (change: (previous: readonly Turn[]) => readonly Turn[]) => {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeId ? { ...session, turns: change(session.turns) } : session,
        ),
      );
    },
    [activeId],
  );

  /**
   * Open a request: the person's words and the assistant's first bubble, in
   * ONE update. Done as two, the rename ran after the turns were already in
   * and its `turns.length === 0` test was never true again — every
   * conversation stayed called "New chat".
   */
  const openTurn = useCallback(
    (trimmed: string, youId: string, reply: Turn) => {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeId
            ? {
                ...session,
                // The first thing asked names the conversation, as a chat should.
                title: session.turns.length === 0 ? trimmed.slice(0, 32) : session.title,
                turns: [...session.turns, { id: youId, from: 'you', text: trimmed }, reply],
              }
            : session,
        ),
      );
    },
    [activeId],
  );

  /*
    The newest turn is the one being read, so the thread follows it — on arrival
    AND on the way back into view.

    `visible` is in the list for a measured reason. The host keeps this panel
    mounted while a person is on Layers or Blocks, and a hidden element measures
    zero: every turn that landed while it was away scrolled the thread to 0, and
    nothing re-ran on return because `turns` had not changed since. Measured in
    Chromium, five replies received while hidden left the reader ~360px above
    the newest one — in the exact scenario keeping it mounted was written for.
  */
  useEffect(() => {
    const thread = threadRef.current;
    if (thread !== null && visible) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [turns, visible]);

  /*
    The history popup dismisses the way every popup a person has used does:
    Escape, or a press anywhere outside it. Escape returns focus to the
    trigger — a menu that closes into nowhere strands a keyboard user on the
    document body with no way back to what they just left.
  */
  useEffect(() => {
    if (!sessionsOpen) {
      return;
    }
    // Focus enters on the chat you are IN, so the arrows start from where the
    // reader already is rather than from the top of a list they did not choose.
    sessionsRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
      ?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const menu = sessionsRef.current;
      if (menu !== null && !menu.contains(event.target as Node)) {
        setSessionsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSessionsOpen(false);
        sessionsTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sessionsOpen]);

  /**
   * What the assistant can SEE, stated rather than guessed at.
   *
   * A person cannot judge a proposal without knowing what it was looking at,
   * and an assistant that stays silent about its context invites them to assume
   * it saw more than it did.
   */
  const selectedId = selectedIds[0];
  const selectedType =
    selectedId === undefined ? undefined : kernel.getDocument().nodes[selectedId]?.type;
  const sees = selectedType === undefined ? 'the whole page' : `${selectedType} · selected`;

  /** The one registry this surface asks — for a run, and for the routing decision. */
  const registry = skillRegistry ?? DEFAULT_AI_SKILL_REGISTRY;

  /**
   * What to offer next, derived and never empty.
   *
   * Recomputed from the catalog, the selection and the last answer's own
   * `followUp`. All three are cheap reads and the strip is small, so it is
   * memoised on what it actually depends on rather than cached across turns:
   * a stale suggestion that no longer matches the selection is worse than no
   * suggestion at all.
   */
  const suggestions = useMemo(
    () =>
      panelSuggestions({
        blocks: kernel.context.registry.blocks(kernel.context.surface),
        selected:
          selectedType === undefined
            ? undefined
            : kernel.context.registry.block(selectedType)?.schema,
        followUp: lastFollowUp(turns),
        locale,
      }),
    [kernel, selectedType, turns, locale],
  );

  /**
   * Answer the ONE question a build asks. Idempotent: the composer's Stop and
   * the card's own buttons race by design, and whichever lands first wins.
   */
  const answerApproval = useCallback((answer: 'build' | 'stop') => {
    const settle = approvalRef.current;
    approvalRef.current = null;
    if (settle !== null) {
      settle(answer);
    }
  }, []);

  /**
   * Undo ONE section of a finished build.
   *
   * The orchestrator labelled every fill (`Assistant: 3/10 — Pricing`) and the
   * kernel keys its history by that label, so the card can find the exact
   * transaction. History is a line, not a set: undoing that one means undoing
   * what was recorded after it, so the card then marks every later section
   * undone too rather than offering a button that would double-count.
   */
  const undoTask = useCallback(
    (turnId: string, position: number, total: number, title: string, spent: number) => {
      const label = taskTransactionLabel(position, total, title);
      const transactions = kernel.transactions();
      let index = -1;
      for (const [at, transaction] of transactions.entries()) {
        if (transaction.command === label) index = at;
      }
      if (index < 0) {
        return;
      }
      const steps = transactions.length - index - spent;
      let undone = 0;
      while (undone < steps && kernel.canUndo()) {
        kernel.undo();
        undone += 1;
      }
      if (undone === 0) {
        return;
      }
      patchTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId && turn.from === 'assistant' && turn.kind === 'built'
            ? {
                ...turn,
                undoneFrom: Math.min(turn.undoneFrom ?? position, position),
                undoneSteps: (turn.undoneSteps ?? 0) + undone,
              }
            : turn,
        ),
      );
      noteFaceTurn('discarded');
    },
    [kernel, noteFaceTurn, patchTurns],
  );

  const startNewChat = useCallback(() => {
    activeRunRef.current?.controller.abort();
    activeRunRef.current = null;
    // The face forgets the run with the lease: the late run.cancelled the
    // abort produces carries the old run id and the reducer drops it.
    resetFace();
    setBusy(false);
    const id = nextId('session');
    setSessions((previous) => [...previous, { id, title: 'New chat', turns: [] }]);
    setActiveId(id);
    setDraft('');
  }, [nextId, resetFace]);

  useEffect(
    () => () => {
      activeRunRef.current?.controller.abort();
      activeRunRef.current = null;
    },
    [],
  );

  /**
   * A PAGE, built as a skeleton plus one run per section.
   *
   * The orchestrator is the same one the engine tests: this function is only
   * the wiring — it opens the turn, forwards the events into the pure reducer,
   * resolves the one approval from the UI, and turns the ending into a report.
   * Everything it does not route here still goes down the single-call path,
   * unchanged.
   */
  const runBuild = useCallback(
    async (trimmed: string) => {
      setBusy(true);
      setDraft('');
      const youId = nextId('turn');
      const buildId = nextId('turn');
      const runId = nextId('run');
      const controller = new AbortController();
      activeRunRef.current = { runId, controller };
      const startedAt = systemClock.now();
      openTurn(trimmed, youId, {
        id: buildId,
        from: 'assistant',
        kind: 'building',
        request: trimmed,
        progress: initialBuildProgress(runId, startedAt),
      });
      const history = historyOf(active?.turns ?? []);
      // Entered synchronously, so Send is answered before the build's first event.
      beginFaceRun(runId, 'the page');

      const patchBuilding = (change: (turn: BuildingTurn) => Turn): void => {
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === buildId && turn.from === 'assistant' && turn.kind === 'building'
              ? change(turn)
              : turn,
          ),
        );
      };

      /*
        The ONE approval, and it is on the LIST — "you understood me, go" —
        not on each of eight sections in turn. The skeleton is already applied
        by the time this is asked, which is why the card says so out loud.
      */
      const askToBuild = (): Promise<'build' | 'stop'> =>
        new Promise<'build' | 'stop'>((resolve) => {
          if (controller.signal.aborted) {
            resolve('stop');
            return;
          }
          const settle = (answer: 'build' | 'stop'): void => {
            patchBuilding((turn) => ({ ...turn, awaiting: false }));
            resolve(answer);
          };
          approvalRef.current = settle;
          // Stop in the composer answers the question too — a person who wants
          // out must never have to find the second button to say so.
          controller.signal.addEventListener(
            'abort',
            () => {
              if (approvalRef.current === settle) {
                approvalRef.current = null;
                settle('stop');
              }
            },
            { once: true },
          );
          patchBuilding((turn) => ({ ...turn, awaiting: true }));
        });

      const selection = kernel.context.store.getState().selection;
      try {
        const result = await runAiBuild({
          runId,
          clock: systemClock,
          kernel,
          provider: planProvider ?? createLocalAiPlanProvider(),
          request: trimmed,
          validationPorts: preflightPorts(),
          selection,
          history,
          ...(memory.hasRecords() ? { additionalContextProviders: [memoryProvider] } : {}),
          skillRegistry: registry,
          ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
          ...catalogPolicyFor(providerKind, selection, agentPolicy),
          /*
            Ask waits on the list; Auto does not wait at all. An `onPlanned`
            that always answered 'build' would be the same behaviour with a lie
            in the middle, so Auto omits the hook entirely.
          */
          ...(mode === 'ask' ? { onPlanned: askToBuild } : {}),
          signal: controller.signal,
          isCurrentRun: (candidateRunId) => activeRunRef.current?.runId === candidateRunId,
          onEvent: (event) => {
            if (isBuildOwnEvent(event)) {
              onBuildEvent?.(event);
            } else {
              onFaceEvent(event);
              onAgentEvent?.(event);
            }
            patchBuilding((turn) => {
              const progress = reduceBuildProgress(turn.progress, event);
              return progress === turn.progress ? turn : { ...turn, progress };
            });
          },
        });

        if (result.outcome === 'fallback' && result.fallback !== undefined) {
          /*
            NOT a build. The scaffold produced fewer than two regions and one
            ordinary run replaced it, so the card is the ordinary plan card and
            nothing about it mentions sections — a build must never be worse
            than the single call it replaces, and must not pretend either.
          */
          const fallback = result.fallback;
          if (fallback.status === 'applied') {
            memory.note(fallback.proposal);
          }
          patchTurns((previous) =>
            previous.map((turn): Turn =>
              turn.id === buildId
                ? {
                    id: turn.id,
                    from: 'assistant',
                    kind: 'plan',
                    plan: fallback.proposal.plan,
                    proposal: fallback.proposal,
                    skills: fallback.proposal.skillActivations,
                    applied: fallback.status === 'applied',
                    mode,
                    /*
                      Rehearsed against the document as it is NOW. For an
                      already-applied plan that is the document the plan
                      produced, so the diff is empty and the card says nothing —
                      correct: "what would change" is a question about a
                      decision that has not been made yet.
                    */
                    ...(fallback.status === 'applied'
                      ? {}
                      : withImpact(impactOfProposal(kernel, fallback.proposal))),
                  }
                : turn,
            ),
          );
          settleFaceTurn({ runId, outcome: 'plan', applied: fallback.status === 'applied' });
          return;
        }

        if (result.scaffold?.status === 'applied') {
          memory.note(result.scaffold.proposal);
        }
        // Read once, outside the updater: an ending has ONE moment, and a
        // state updater React may replay must not sample a clock twice.
        const endedAt = systemClock.now();
        patchTurns((previous) =>
          previous.map((turn): Turn => {
            if (turn.id !== buildId || turn.from !== 'assistant' || turn.kind !== 'building') {
              return turn;
            }
            const receipt = buildReceipt(turn.progress, endedAt);
            return {
              id: turn.id,
              from: 'assistant',
              kind: 'built',
              progress: turn.progress,
              request: trimmed,
              undoable: true,
              ...(receipt === null ? {} : { receipt }),
              ...(result.outcome === 'completed' ? {} : { stopped: true }),
            };
          }),
        );
        if (result.outcome === 'completed') {
          settleFaceTurn({ runId, outcome: 'plan', applied: result.applied > 0 });
        } else {
          settleFaceTurn({ runId, outcome: 'stopped' });
        }
      } catch (cause: unknown) {
        const endedAt = systemClock.now();
        const failure = controller.signal.aborted ? null : classifyAiRunFailure(cause);
        patchTurns((previous) =>
          previous.map((turn): Turn => {
            if (turn.id !== buildId) return turn;
            const building = turn.from === 'assistant' && turn.kind === 'building' ? turn : null;
            if (failure !== null) {
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'refused',
                text: failure.message,
                failure,
                request: trimmed,
              };
            }
            /*
              Stopped. A build that never got a section list is an ordinary
              stop and reads as one — a report saying "0/0" would be a card
              about nothing.
            */
            if (building === null || building.progress.tasks.length === 0) {
              const run = building?.progress.run ?? null;
              const receipt = run === null ? null : receiptOf(run, endedAt);
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'stopped',
                ...(receipt === null ? {} : { receipt }),
              };
            }
            const receipt = buildReceipt(building.progress, endedAt);
            return {
              id: turn.id,
              from: 'assistant',
              kind: 'built',
              progress: building.progress,
              request: trimmed,
              undoable: true,
              stopped: true,
              ...(receipt === null ? {} : { receipt }),
            };
          }),
        );
        settleFaceTurn(
          failure === null
            ? { runId, outcome: 'stopped' }
            : { runId, outcome: 'refused', retryable: failure.retryable },
        );
      } finally {
        approvalRef.current = null;
        if (ownsRun(activeRunRef.current, runId)) {
          activeRunRef.current = null;
          setBusy(false);
        }
      }
    },
    [
      active,
      agentPolicy,
      beginFaceRun,
      kernel,
      memory,
      memoryProvider,
      mode,
      nextId,
      onAgentEvent,
      onBuildEvent,
      onFaceEvent,
      openTurn,
      patchTurns,
      planProvider,
      providerKind,
      registry,
      selectedSkillIds,
      settleFaceTurn,
    ],
  );

  const ask = useCallback(
    async (request: string) => {
      const trimmed = request.trim();
      if (trimmed.length === 0 || busy) {
        return;
      }
      /*
        A PAGE is a build; a section is one call. Plan mode never builds: the
        skeleton would apply, and Plan must never apply. Everything else takes
        the path it took before this branch existed.
      */
      if (mode !== 'plan' && activatesBuildArchetype(registry, trimmed)) {
        await runBuild(trimmed);
        return;
      }
      setBusy(true);
      setDraft('');
      const thinkingId = nextId('turn');
      // No spinner without a subject: the wait says what is being read.
      const subject = selectedType === undefined ? 'the page' : `the ${selectedType} block`;
      const youId = nextId('turn');
      openTurn(trimmed, youId, {
        id: thinkingId,
        from: 'assistant',
        kind: 'thinking',
        subject,
        run: initialRunProgress(mode === 'auto' ? 'auto' : 'never', systemClock.now()),
      });

      const history = historyOf(active?.turns ?? []);

      const runId = nextId('run');
      const controller = new AbortController();
      activeRunRef.current = { runId, controller };
      // Entered synchronously, so Send is answered before the run's first event.
      beginFaceRun(runId, subject);
      /*
        @mentions ARE the selection: naming a block in the request is the most
        direct way a person points at it, so named blocks (that really exist)
        replace the canvas selection as the request's focus.
      */
      const mentioned = [...trimmed.matchAll(MENTION_IDS)]
        .map((match) => match[1] ?? '')
        .filter((id) => kernel.getDocument().nodes[id] !== undefined);
      /*
        PLAN takes its own route, and it is a different function, not a flag.

        `runAiAgent` promises a plan of COMMANDS: it refuses an empty command
        policy before the provider is called, its validator rejects a plan with
        zero commands, and its output contract demands at least one. Threading
        "but not this time" through all three would have been three exceptions
        pretending to be one rule. `outlineAiPlan` asks the same provider, with
        the same skills and the same context, and simply never goes near the
        door — there is nothing to validate, because there is nothing to apply.
      */
      if (mode === 'plan') {
        try {
          const outline = await outlineAiPlan({
            kernel,
            provider: planProvider ?? createLocalAiPlanProvider(),
            request: trimmed,
            selection: mentioned.length > 0 ? mentioned : kernel.context.store.getState().selection,
            history,
            skillRegistry: registry,
            ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
            signal: controller.signal,
          });
          if (!ownsRun(activeRunRef.current, runId)) return;
          settleFaceTurn({ runId, outcome: 'plan', applied: false });
          patchTurns((previous) =>
            previous.map((turn) =>
              turn.id === thinkingId
                ? {
                    id: thinkingId,
                    from: 'assistant',
                    kind: 'outline',
                    text: outline.rationale,
                    ...(outline.followUp === undefined ? {} : { followUp: outline.followUp }),
                    ...(outline.skillActivations === undefined
                      ? {}
                      : { skills: outline.skillActivations }),
                    dropped: outline.droppedCommands,
                  }
                : turn,
            ),
          );
        } catch (error) {
          /*
            `ownsRun`, not a direct `.runId` read. New chat and unmount set the
            lease to null, so reading through it threw — a person who started a
            plan and then opened a new chat crashed the panel.
          */
          if (!ownsRun(activeRunRef.current, runId)) return;
          const endedAt = systemClock.now();
          if (controller.signal.aborted) {
            /*
              The person pressed Stop. That is an OUTCOME, not an error — the
              same rule the ordinary run follows. Rendering the abort exception
              as a retryable refusal put the platform's own AbortError on screen
              and left the face showing failure for something nobody got wrong.
            */
            settleFaceTurn({ runId, outcome: 'stopped' });
            patchTurns((previous) =>
              previous.map((turn): Turn => {
                if (turn.id !== thinkingId) return turn;
                const receipt =
                  turn.from === 'assistant' && turn.kind === 'thinking'
                    ? receiptOf(turn.run, endedAt, turn.progress)
                    : null;
                return {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'stopped',
                  ...(receipt === null ? {} : { receipt }),
                };
              }),
            );
          } else {
            settleFaceTurn({ runId, outcome: 'refused', retryable: true });
            patchTurns((previous) =>
              previous.map((turn) =>
                turn.id === thinkingId
                  ? {
                      id: thinkingId,
                      from: 'assistant',
                      kind: 'refused',
                      text:
                        error instanceof Error ? error.message : 'The plan could not be written.',
                      request: trimmed,
                    }
                  : turn,
              ),
            );
          }
        } finally {
          if (ownsRun(activeRunRef.current, runId)) {
            activeRunRef.current = null;
            setBusy(false);
          }
        }
        return;
      }

      const planSkills = skillsForMode(mode, selectedSkillIds);
      try {
        const result = await runAiAgent({
          runId,
          clock: systemClock,
          kernel,
          provider: planProvider ?? createLocalAiPlanProvider(),
          request: trimmed,
          validationPorts: preflightPorts(),
          selection: mentioned.length > 0 ? mentioned : kernel.context.store.getState().selection,
          history,
          ...(memory.hasRecords() ? { additionalContextProviders: [memoryProvider] } : {}),
          skillRegistry: registry,
          /*
            PLAN carries its own skill (see `skillsForMode`), which is what makes
            its request different from Ask's — and, through an empty
            `restrictToCommands` that intersects everything else down to nothing,
            what makes it structurally unable to write.
          */
          ...(planSkills === undefined ? {} : { selectedSkillIds: planSkills }),
          /*
            The host's policy wins over the catalog helper's, always: the helper
            supplies a budget the offline path needs, not a decision a host may
            not override.
          */
          ...catalogPolicyFor(
            providerKind,
            mentioned.length > 0 ? mentioned : kernel.context.store.getState().selection,
            agentPolicy,
          ),
          apply: mode === 'auto' ? 'auto' : 'never',
          signal: controller.signal,
          isCurrentRun: (candidateRunId) => activeRunRef.current?.runId === candidateRunId,
          onEvent: (event) => {
            onFaceEvent(event);
            patchTurns((previous) =>
              previous.map((turn) => {
                if (
                  turn.id !== thinkingId ||
                  turn.from !== 'assistant' ||
                  turn.kind !== 'thinking'
                ) {
                  return turn;
                }
                const run = reduceRunProgress(turn.run, event);
                if (run === turn.run && event.type !== 'plan.progress') return turn;
                return {
                  ...turn,
                  run,
                  ...(event.type === 'plan.progress' ? { progress: event.text } : {}),
                };
              }),
            );
            onAgentEvent?.(event);
          },
        });
        if (result.status === 'applied') {
          memory.note(result.proposal);
        }
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === thinkingId
              ? {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'plan',
                  plan: result.proposal.plan,
                  proposal: result.proposal,
                  skills: result.proposal.skillActivations,
                  applied: result.status === 'applied',
                  mode,
                  ...(result.status === 'applied'
                    ? {}
                    : withImpact(impactOfProposal(kernel, result.proposal))),
                  costTokens: estimateRequestTokens(trimmed, result.context, history),
                  ...(turn.from === 'assistant' && turn.kind === 'thinking'
                    ? { run: turn.run }
                    : {}),
                }
              : turn,
          ),
        );
        settleFaceTurn({ runId, outcome: 'plan', applied: result.status === 'applied' });
      } catch (cause: unknown) {
        /*
          Read once, outside the updater: the ending has ONE moment, and a
          state updater React may replay must not sample a clock twice.
          `run.cancelled` / `run.failed` are emitted before the runner
          rethrows, so the settled rows are already in state by the time this
          reduction runs — the receipt reads the finished run, not a guess.
        */
        const endedAt = systemClock.now();
        if (controller.signal.aborted) {
          // The person pressed Stop. That is an outcome, not an error.
          patchTurns((previous) =>
            previous.map((turn): Turn => {
              if (turn.id !== thinkingId) return turn;
              const receipt =
                turn.from === 'assistant' && turn.kind === 'thinking'
                  ? receiptOf(turn.run, endedAt, turn.progress)
                  : null;
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'stopped',
                ...(receipt === null ? {} : { receipt }),
              };
            }),
          );
          settleFaceTurn({ runId, outcome: 'stopped' });
        } else {
          const failure = classifyAiRunFailure(cause);
          patchTurns((previous) =>
            previous.map((turn): Turn => {
              if (turn.id !== thinkingId) return turn;
              const thinking = turn.from === 'assistant' && turn.kind === 'thinking' ? turn : null;
              const receipt =
                thinking === null ? null : receiptOf(thinking.run, endedAt, thinking.progress);
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'refused',
                text: failure.message,
                failure,
                request: trimmed,
                ...(thinking !== null && thinking.run.failedAt !== null
                  ? { failedAt: thinking.run.failedAt }
                  : {}),
                ...(receipt === null ? {} : { receipt }),
              };
            }),
          );
          settleFaceTurn({ runId, outcome: 'refused', retryable: failure.retryable });
        }
      } finally {
        if (ownsRun(activeRunRef.current, runId)) {
          activeRunRef.current = null;
          setBusy(false);
        }
      }
    },
    [
      active,
      agentPolicy,
      beginFaceRun,
      busy,
      kernel,
      memory,
      memoryProvider,
      mode,
      nextId,
      onAgentEvent,
      onFaceEvent,
      openTurn,
      patchTurns,
      planProvider,
      providerKind,
      registry,
      runBuild,
      selectedSkillIds,
      selectedType,
      settleFaceTurn,
    ],
  );

  const stop = useCallback(() => {
    activeRunRef.current?.controller.abort();
  }, []);

  /** Every block a trailing @ can point at, filtered as the person types. */
  const mentionCandidates =
    mentionQuery === null
      ? []
      : Object.values(kernel.getDocument().nodes)
          .filter(
            (node) =>
              node.id !== kernel.getDocument().rootId &&
              (node.id.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                node.type.toLowerCase().includes(mentionQuery.toLowerCase())),
          )
          .slice(0, 8)
          .map((node) => {
            const excerpt = Object.values(node.props).find(
              (value): value is string => typeof value === 'string' && value.trim() !== '',
            );
            return { id: node.id, type: node.type, excerpt: excerpt?.slice(0, 48) };
          });

  const pickMention = useCallback(
    (id: string) => {
      setDraft((current) => {
        const query = mentionQuery ?? '';
        const at = current.lastIndexOf(`@${query}`);
        if (at < 0) {
          return `${current}@${id} `;
        }
        return `${current.slice(0, at)}@${id} ${current.slice(at + query.length + 1)}`;
      });
      setMentionQuery(null);
    },
    [mentionQuery],
  );

  const accept = useCallback(
    (id: string, proposal: AiValidatedProposal) => {
      /*
        FAILS CLOSED against the CURRENT mode, not the turn's.

        Every gate here used to read the mode the turn was proposed under, and
        Plan was therefore a label on old cards rather than a state of the
        panel. An Ask proposal made a minute ago still showed Apply after the
        person switched to Plan, and its Preview dialog applied unconditionally
        — so "Only plan — never apply" was one or two clicks from an apply, on
        work the panel was currently promising not to touch.

        The check belongs HERE, at the single function every route reaches: the
        card's button, the preview's button, and anything added later. A gate on
        a button is a gate somebody can forget to copy.
      */
      if (mode === 'plan') {
        return;
      }
      try {
        applyAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
        memory.note(proposal);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? { ...turn, applied: true }
              : turn,
          ),
        );
        noteFaceTurn('applied');
      } catch (cause: unknown) {
        const failure = classifyAiRunFailure(cause);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'refused',
                  text: failure.message,
                  failure,
                }
              : turn,
          ),
        );
      }
    },
    [kernel, memory, mode, noteFaceTurn, patchTurns],
  );

  /**
   * Arrow keys through the history, because `role="menu"` PROMISES them.
   *
   * The items are native buttons, so Tab already reaches each one — but a menu
   * that answers Tab and ignores ArrowDown is a menu only in the accessibility
   * tree, and a screen-reader user who is told "menu" reaches for the arrows
   * first. Home/End are part of the same promise.
   */
  const moveThroughSessions = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }
    event.preventDefault();
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    ];
    if (items.length === 0) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }, []);

  /**
 * What the plan would change, or nothing when it cannot be rehearsed.
 *
 * A failure here is NOT a failure of the run: a plan whose preview throws is
 * still a plan a person may read and decide about, and the panel simply says
 * less rather than turning a working proposal into an error.
 */
function impactOfProposal(
  kernel: BuilderKernel,
  proposal: AiValidatedProposal,
): PlanImpact | undefined {
  try {
    const previewed = previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
    return planImpact(kernel.getDocument(), previewed);
  } catch {
    return undefined;
  }
}

/*
  `exactOptionalPropertyTypes` distinguishes "absent" from "present and
  undefined", and the turn means the first. Spreading an empty object is how a
  missing impact stays missing.
*/
function withImpact(impact: PlanImpact | undefined): { impact?: PlanImpact } {
  return impact === undefined ? {} : { impact };
}

/** Rehearse the plan on a scratch kernel and show the result. Looking ≠ applying. */
  /**
   * In Plan mode, NOTHING in this panel changes the document.
   *
   * Apply was gated first, and that turned out to be half a rule: the applied
   * card's Undo and the build report's per-section Undo both called
   * `kernel.undo()` with no gate at all, so a panel that had hidden every Apply
   * and promised "only plan" still rewrote the page on one click. A person who
   * chose Plan is entitled to read every control in it as safe.
   *
   * Undo is not withheld to protect them from themselves — it is withheld
   * because the mode is a promise about this panel, and a promise with an
   * exception is not one. The way to undo is to leave Plan, which is one click
   * and says what it does.
   */
  const mutatesLiveDocument = mode !== 'plan';

  const openPreview = useCallback(
    (id: string, proposal: AiValidatedProposal) => {
      try {
        const document = previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
        setPreview({ id, proposal, document });
      } catch (cause: unknown) {
        const failure = classifyAiRunFailure(cause);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'refused',
                  text: failure.message,
                  failure,
                }
              : turn,
          ),
        );
      }
    },
    [kernel, patchTurns],
  );

  // The dialog answers Escape like every dialog a person has used.
  useEffect(() => {
    if (preview === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreview(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [preview]);

  const discard = useCallback(
    (id: string) => {
      patchTurns((previous) =>
        previous.map((turn) =>
          turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
            ? { id: turn.id, from: 'assistant', kind: 'discarded' }
            : turn,
        ),
      );
      noteFaceTurn('discarded');
    },
    [noteFaceTurn, patchTurns],
  );

  return (
    <section className="pg-chat" aria-label="Assistant" data-mood={face.mood}>
      <header className="pg-chat__head" ref={watchHeadZone}>
        <div className="pg-chat__title">
          <div className="pg-chat__brand">
            {/* The tool is called Assistant (the region's accessible name);
                the person inside it is أبو غضب. The face is decoration — his
                voice, below, is what a screen reader hears. The seat writes
                the look and the press; the face only reads them. */}
            <span className="pg-chat__brand-mark" aria-hidden="true" ref={holdHeadSeat}>
              <AgentFace
                size="md"
                live
                mood={face.mood}
                variant={face.variant}
                outcome={face.outcome}
                typing={face.typing}
              />
            </span>
            <h2 className="pg-chat__heading">
              <span className="pg-chat__name" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                {AGENT_NAME[locale]}
              </span>
            </h2>
          </div>
          <ChromeButton variant="quiet" size="sm" onClick={startNewChat}>
            <IconPlus />
            New chat
          </ChromeButton>
        </div>
        <AgentVoice className="pg-chat__voice" snapshot={face} locale={locale} />
        <p className="pg-chat__sees">Sees: {sees}</p>
        {sessions.length > 1 ? (
          <div className="pg-chat__sessions" ref={sessionsRef}>
            <button
              type="button"
              className="pg-chat__sessions-trigger"
              ref={sessionsTriggerRef}
              aria-label="Conversation"
              aria-haspopup="menu"
              aria-expanded={sessionsOpen}
              aria-controls={sessionsOpen ? sessionsListId : undefined}
              onClick={() => {
                setSessionsOpen((open) => !open);
              }}
            >
              <span className="pg-chat__sessions-title">{active?.title ?? 'New chat'}</span>
              <span className="pg-chat__sessions-count">{sessions.length}</span>
              <span className="pg-chat__sessions-chevron" aria-hidden="true">
                <IconChevron />
              </span>
            </button>
            {sessionsOpen ? (
              <div
                className="pg-chat__sessions-menu"
                id={sessionsListId}
                role="menu"
                onKeyDown={moveThroughSessions}
              >
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={session.id === activeId}
                    className="pg-chat__sessions-item"
                    onClick={() => {
                      setActiveId(session.id);
                      setSessionsOpen(false);
                    }}
                  >
                    <span className="pg-chat__sessions-item-check" aria-hidden="true">
                      {session.id === activeId ? <IconCheck /> : null}
                    </span>
                    <span className="pg-chat__sessions-item-title">{session.title}</span>
                    <span className="pg-chat__sessions-item-meta">
                      {session.turns.length === 0
                        ? 'Empty'
                        : `${String(session.turns.length)} messages`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="pg-chat__thread" ref={threadRef} role="log" aria-label="Conversation">
        {turns.length === 0 ? (
          <div className="pg-chat__empty" ref={watchEmptyZone}>
            <span className="pg-chat__empty-mark" aria-hidden="true" ref={holdEmptySeat}>
              <AgentFace mood="idle" size="lg" />
            </span>
            <p>Ask for a section and I will propose the exact changes.</p>
          </div>
        ) : null}

        {turns.map((turn) => (
          <article
            key={turn.id}
            className="pg-chat__turn"
            data-from={turn.from}
            data-kind={turn.from === 'assistant' ? turn.kind : 'text'}
          >
            {turn.from === 'you' ? (
              <p className="pg-chat__you" dir="auto">
                {turn.text}
              </p>
            ) : (
              <div className="pg-chat__reply">
                {/* One avatar for every reply: the live thinking bubble mirrors
                  the header's phase (still static — sm never animates), every
                  other bubble is frozen at the mood it earned. */}
                <span className="pg-chat__avatar" aria-hidden="true">
                  <AgentFace
                    size="sm"
                    {...(turn.kind === 'thinking' || turn.kind === 'building'
                      ? { mood: face.mood, variant: face.variant }
                      : turn.kind === 'built'
                        ? { mood: turn.stopped === true ? ('stopped' as const) : ('done' as const) }
                        : moodForTurn(turn))}
                  />
                </span>
                <div className="pg-chat__reply-body">
                  {turn.kind === 'thinking' ? (
                    <div className="pg-chat__inflight" data-state="inflight">
                      {/* The rows narrate; the panel's own voice is the ONE live
                        region, so the card stays silent. No Cancel here: the
                        composer's Stop is the one abort. */}
                      <LiveStageClock heading={`Working on ${turn.subject}`} run={turn.run} />
                      <div className="pg-chat__thinking">
                        <span className="pg-chat__thinking-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        <p dir="auto">{turn.progress ?? `Reading ${turn.subject}…`}</p>
                      </div>
                    </div>
                  ) : null}
                  {turn.kind === 'building' ? (
                    <div className="pg-chat__inflight" data-state="building">
                      {turn.awaiting === true ? (
                        /* THE ONE QUESTION: the direction, the list, and go. */
                        <div
                          className="pg-chat__card pg-chat__card--pending"
                          data-state="awaiting-build"
                          role="group"
                          aria-label="Build this page"
                        >
                          <div className="pg-chat__card-head">
                            <span className="pg-chat__card-kind" data-kind="ask">
                              <IconSparkle />
                              Build
                            </span>
                            <span className="pg-chat__card-count">
                              {String(turn.progress.tasks.length)} sections
                            </span>
                          </div>
                          <p className="pg-chat__rationale" dir="auto">
                            {turn.progress.direction}
                          </p>
                          <ol className="pg-chat__steps">
                            {turn.progress.tasks.map((task) => (
                              <li key={`${turn.id}-ask-${String(task.position)}`}>
                                <span className="pg-chat__step-title">{task.title}</span>
                              </li>
                            ))}
                          </ol>
                          <p className="pg-chat__tasks-note">
                            The skeleton is already on the page. Each section is applied as its own
                            change, so any step can be undone on its own.
                          </p>
                          <div className="pg-chat__decide">
                            <ChromeButton
                              variant="primary"
                              onClick={() => {
                                answerApproval('build');
                              }}
                            >
                              <IconCheck />
                              Build
                            </ChromeButton>
                            <ChromeButton
                              variant="quiet"
                              size="sm"
                              className="pg-chat__decide-discard"
                              onClick={() => {
                                answerApproval('stop');
                              }}
                            >
                              <IconStop />
                              Stop build
                            </ChromeButton>
                          </div>
                        </div>
                      ) : turn.progress.tasks.length === 0 ? (
                        /* Before the list exists there is one thing to watch:
                           the skeleton. It is an ordinary run, so it gets the
                           ordinary rows. */
                        <>
                          {turn.progress.run === null ? null : (
                            <LiveStageClock
                              heading="Working on the page skeleton"
                              run={turn.progress.run}
                            />
                          )}
                          <div className="pg-chat__thinking">
                            <span className="pg-chat__thinking-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                            <p>Laying out the page…</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="pg-chat__tasks-head">
                            <span className="pg-chat__tasks-count">
                              {buildCount(turn.progress)}
                            </span>
                            {buildEta(turn.progress) === null ? null : (
                              <span className="pg-chat__tasks-eta">
                                {` · ${buildEta(turn.progress) ?? ''}`}
                              </span>
                            )}
                          </p>
                          <ol className="pg-chat__tasks" aria-label="Sections">
                            {turn.progress.tasks.map((task) => (
                              <li
                                key={`${turn.id}-task-${String(task.position)}`}
                                className="pg-chat__task"
                                data-status={task.status}
                              >
                                <span className="pg-chat__task-line">
                                  <span className="pg-chat__task-title" dir="auto">
                                    {task.title}
                                  </span>
                                  <span className="pg-chat__task-state">
                                    {TASK_STATUS_LABEL[task.status]}
                                  </span>
                                </span>
                                {/* The open section carries the very rows a
                                    single call would have shown — the same
                                    clock, one level in. */}
                                {task.status === 'running' && turn.progress.run !== null ? (
                                  <span className="pg-chat__task-run">
                                    <LiveStageClock
                                      heading={`Working on ${task.title}`}
                                      run={turn.progress.run}
                                    />
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        </>
                      )}
                    </div>
                  ) : null}
                  {turn.kind === 'built' ? (
                    <div
                      className={`pg-chat__card ${
                        turn.stopped === true
                          ? 'pg-chat__card--discarded'
                          : 'pg-chat__card--applied'
                      }`}
                      data-state={turn.stopped === true ? 'build-stopped' : 'built'}
                    >
                      <div className="pg-chat__card-head">
                        <span
                          className="pg-chat__card-kind"
                          data-kind={turn.stopped === true ? 'stopped' : 'applied'}
                        >
                          {turn.stopped === true ? <IconStop /> : <IconCheck />}
                          {turn.stopped === true ? 'Stopped' : 'Built'}
                        </span>
                        <span className="pg-chat__card-count">{buildCount(turn.progress)}</span>
                      </div>
                      {turn.receipt === undefined ? null : (
                        <p className="pg-chat__receipt">
                          {`${String(turn.receipt.applied)}/${String(turn.receipt.total)} built in ${turn.receipt.elapsed}`}
                        </p>
                      )}
                      <ol className="pg-chat__tasks" aria-label="Sections">
                        {turn.progress.tasks.map((task) => (
                          <li
                            key={`${turn.id}-built-${String(task.position)}`}
                            className="pg-chat__task"
                            data-status={task.status}
                          >
                            <span className="pg-chat__task-line">
                              <span className="pg-chat__task-title" dir="auto">
                                {task.title}
                              </span>
                              {/*
                                Withheld in Plan mode for the same reason the
                                card's Undo is: this one loops `kernel.undo()`,
                                so it writes more than the others, not less.
                              */}
                              {task.status === 'applied' &&
                              turn.undoable === true &&
                              mutatesLiveDocument ? (
                                <ChromeButton
                                  variant="quiet"
                                  size="sm"
                                  className="pg-chat__task-undo"
                                  aria-label={`Undo ${task.title}`}
                                  disabled={
                                    turn.undoneFrom !== undefined &&
                                    task.position >= turn.undoneFrom
                                  }
                                  onClick={() => {
                                    undoTask(
                                      turn.id,
                                      task.position,
                                      turn.progress.tasks.length,
                                      task.title,
                                      turn.undoneSteps ?? 0,
                                    );
                                  }}
                                >
                                  <IconUndo />
                                  Undo
                                </ChromeButton>
                              ) : (
                                <span className="pg-chat__task-state">
                                  {TASK_STATUS_LABEL[task.status]}
                                </span>
                              )}
                            </span>
                            {/* A section that would not be written twice says
                                why, in the door's own words. */}
                            {task.status === 'skipped' && task.reason !== undefined ? (
                              <span className="pg-chat__task-reason" dir="auto">
                                {task.reason}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                      {turn.request === undefined ||
                      turn.progress.tasks.every((task) => task.status !== 'skipped') ? null : (
                        <ChromeButton
                          variant="quiet"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            void ask(
                              retrySkippedRequest(
                                turn.progress.tasks
                                  .filter((task) => task.status === 'skipped')
                                  .map((task) => task.title),
                              ),
                            );
                          }}
                        >
                          <IconSparkle />
                          Retry skipped
                        </ChromeButton>
                      )}
                    </div>
                  ) : null}
                  {turn.kind === 'stopped' ? (
                    <div className="pg-chat__card pg-chat__card--discarded" data-state="stopped">
                      <p className="pg-chat__refused">Stopped.</p>
                      {endingReceipt('Stopped', turn.receipt)}
                    </div>
                  ) : null}
                  {turn.kind === 'refused' ? (
                    <div className="pg-chat__card pg-chat__card--refused" data-state="refused">
                      <IconAlert />
                      <div>
                        <p className="pg-chat__refused" dir="auto">
                          {turn.text}
                        </p>
                        {turn.failure === undefined ? null : (
                          <p className="pg-chat__failure-meta">
                            <code className="pg-chat__code">{turn.failure.code}</code>
                            {` · ${turn.failure.source}`}
                            {turn.failure.status === undefined
                              ? ''
                              : ` · HTTP ${String(turn.failure.status)}`}
                            {/* The receipt below already names the row; only a
                              card without one has to say it here. */}
                            {turn.failedAt === undefined || turn.receipt !== undefined
                              ? ''
                              : ` · at ${GENERATION_STAGE_LABELS[turn.failedAt]}`}
                          </p>
                        )}
                        {endingReceipt('Failed', turn.receipt)}
                        {turn.failure?.retryable === true && turn.request !== undefined ? (
                          <ChromeButton
                            variant="quiet"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              void ask(turn.request ?? '');
                            }}
                          >
                            Retry
                          </ChromeButton>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {turn.kind === 'discarded' ? (
                    <div className="pg-chat__card pg-chat__card--discarded" data-state="discarded">
                      <p className="pg-chat__refused">Discarded.</p>
                    </div>
                  ) : null}
                  {turn.kind === 'outline' ? (
                    /*
                      A plan, read as a plan. No Apply and no Preview, and not
                      because a condition hides them: this turn has no proposal
                      in it, so there is nothing for either button to act on.
                      The follow-up is offered in the suggestion strip above the
                      composer, like every other one.
                    */
                    <div className="pg-chat__card pg-chat__card--outline" data-state="outline">
                      <p className="pg-chat__outline" dir="auto" lang={localeOf(turn.text)}>
                        {turn.text}
                      </p>
                      {turn.dropped === 0 ? null : (
                        <p className="pg-chat__outline-note">
                          {`Planning only — ${String(turn.dropped)} proposed change${
                            turn.dropped === 1 ? '' : 's'
                          } ${turn.dropped === 1 ? 'was' : 'were'} not kept. Switch to Ask or Auto to build.`}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {turn.kind === 'plan' ? (
                    <div
                      className={`pg-chat__card ${
                        turn.applied ? 'pg-chat__card--applied' : 'pg-chat__card--pending'
                      }`}
                      data-state={turn.applied ? 'applied' : 'pending'}
                    >
                      <div className="pg-chat__card-head">
                        <span
                          className="pg-chat__card-kind"
                          data-kind={turn.applied ? 'applied' : (turn.mode ?? 'ask')}
                        >
                          {turn.applied ? <IconCheck /> : <IconSparkle />}
                          {turn.applied
                            ? 'Applied'
                            : (turn.mode ?? 'ask') === 'plan'
                              ? 'Plan'
                              : 'Proposal'}
                        </span>
                        <span className="pg-chat__card-count">
                          {String(turn.plan.commands.length)}{' '}
                          {turn.plan.commands.length === 1 ? 'step' : 'steps'}
                        </span>
                      </div>
                      <p className="pg-chat__rationale" dir="auto">
                        {turn.plan.rationale}
                      </p>
                      {turn.skills === undefined || turn.skills.length === 0 ? null : (
                        <ul aria-label="Activated Skills" className="pg-chat__steps">
                          {turn.skills.map((skill) => (
                            <li key={`${turn.id}-${skill.id}`}>
                              <span className="pg-chat__step-title">
                                {skill.id} · v{skill.version} ·{' '}
                                {shortSkillFingerprint(skill.contentFingerprint)}
                              </span>
                              <code className="pg-chat__step-cmd">{skill.reason}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                      {/*
                        WHAT WOULD CHANGE, before deciding.

                        Not a re-reading of the step list and not a second model
                        call: `previewAiPlan` already runs the plan on a scratch
                        kernel through the real door, so diffing that document
                        against the live one is the only honest answer. The two
                        differ exactly where it matters — a `setProp` to the
                        value already there reads like work in the step list and
                        moves nothing on the page, and a person about to press
                        Apply should be told that before spending an undo step
                        to find out.
                      */}
                      {turn.impact === undefined && turn.costTokens === undefined ? null : (
                        <p className="pg-chat__impact" dir="auto">
                          {turn.impact === undefined ? null : describeImpact(turn.impact, locale)}
                          {turn.costTokens === undefined ? null : (
                            <>
                              {turn.impact === undefined ? null : ' '}
                              {/*
                                Labelled an ESTIMATE, and it is one: tokens
                                counted from canonical JSON with no model asked.
                                It is also the REQUEST, not the answer — the
                                same number `generateAiPlan` checks its context
                                budget against, so a person reading it is
                                reading the figure the engine used.
                              */}
                              <span className="pg-chat__cost">
                                {describeCost(turn.costTokens, locale)}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                      {/* Each step in a person's words; the exact command rides
                        along in mono as the technical truth, never the headline. */}
                      <ol className="pg-chat__steps">
                        {turn.plan.commands.map((step, index) => (
                          <li key={`${turn.id}-${String(index)}`}>
                            <span className="pg-chat__step-title">{describeStep(step)}</span>
                            <code className="pg-chat__step-cmd">{step.command}</code>
                          </li>
                        ))}
                      </ol>
                      {timingReceipt(turn.run)}
                      {turn.applied ? (
                        <p className="pg-chat__applied">
                          <IconCheck />
                          Applied as one change.{' '}
                          {/*
                            A revived card cannot offer this. Its transaction
                            belongs to the session that made it, and this
                            session's history has entirely different entries at
                            the same position — so the button would undo
                            somebody else's work while claiming to undo this
                            plan. `proposal` is the marker: persistence
                            deliberately drops it, so its absence means revived.
                          */}
                          {turn.proposal === undefined ? null : mutatesLiveDocument ? (
                            <ChromeButton
                              variant="quiet"
                              size="sm"
                              onClick={() => {
                                kernel.undo();
                              }}
                            >
                              <IconUndo />
                              Undo
                            </ChromeButton>
                          ) : (
                            <span className="pg-chat__plan-only">
                              Planning only — switch mode to undo.
                            </span>
                          )}
                        </p>
                      ) : (
                        <div className="pg-chat__decide">
                          {/*
                            Hidden when the plan was PROPOSED in Plan mode, and
                            when the panel is in Plan mode NOW. The second is
                            the one that was missing: a proposal made in Ask
                            kept its Apply after the person switched to Plan.
                            `accept` refuses either way — this only stops the
                            panel from offering what it would refuse.
                          */}
                          {(turn.mode ?? 'ask') === 'plan' ||
                          mode === 'plan' ||
                          turn.proposal === undefined ? null : (
                            <ChromeButton
                              variant="primary"
                              onClick={() => {
                                if (turn.proposal !== undefined) {
                                  accept(turn.id, turn.proposal);
                                }
                              }}
                            >
                              <IconCheck />
                              Apply
                            </ChromeButton>
                          )}
                          {turn.proposal === undefined ? null : (
                            <ChromeButton
                              variant="quiet"
                              size="sm"
                              onClick={() => {
                                if (turn.proposal !== undefined) {
                                  openPreview(turn.id, turn.proposal);
                                }
                              }}
                            >
                              <IconEye />
                              Preview
                            </ChromeButton>
                          )}
                          {onReviewAsCode === undefined ? null : (
                            <ChromeButton variant="quiet" size="sm" onClick={onReviewAsCode}>
                              <IconCode />
                              Review as code
                            </ChromeButton>
                          )}
                          <ChromeButton
                            variant="quiet"
                            size="sm"
                            className="pg-chat__decide-discard"
                            onClick={() => {
                              discard(turn.id);
                            }}
                          >
                            <IconClose />
                            Discard
                          </ChromeButton>
                          {turn.proposal === undefined ? (
                            <p className="pg-chat__refused">
                              This saved proposal expired after reload. Ask again to revalidate it.
                            </p>
                          ) : null}
                        </div>
                      )}
                      {/*
                        The plan's own "and next…" is NOT drawn here any more.

                        It moved to the suggestion strip above the composer,
                        which is the one place a person is deciding what to say
                        next — and, unlike a card inside the log, it does not
                        scroll away the moment the next message arrives. Drawing
                        it in both places put two identical buttons for one
                        action on screen at once.
                      */}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {/*
        The suggestion strip, ABOVE the composer and outside the thread.

        Outside, because it is not part of the conversation: putting it in the
        log made it scroll away with the messages, which is how the old starters
        disappeared after the first turn and never came back. Above the composer
        is where the next thing a person says is being decided.
      */}
      {/*
        STAYS MOUNTED while the assistant works — disabled, not removed.

        Unmounting it did two things at once, and both are the kind a person
        feels rather than reads. The chip they had just pressed vanished from
        under their finger, so keyboard focus fell to `<body>` and the next Tab
        started over from the top of the panel. And the composer jumped: the
        strip is ~215px in its stacked layout, so pressing Send yanked the
        input up, and the answer dropped it back down — two lurches around the
        one control a person is looking at.

        Disabled chips keep the height, keep the focus, and say the true thing:
        these are still your options, in a moment.
      */}
      {suggestions.length === 0 ? null : (
        <ul
          className="pg-chat__starters"
          aria-label="Suggestions"
          /*
            TWO layouts, one list.

            On an empty panel there is nothing to crowd, and a person who has
            said nothing yet is reading rather than continuing: the suggestions
            stack, full width, as generous targets. The moment a conversation
            exists they become a one-row rail — the same suggestions, one tap
            away, at a fixed height — because at that point the thread is what
            the panel is for, and a column of cards was eating half of it.
          */
          data-layout={turns.length === 0 ? 'stack' : 'rail'}
          onWheel={(event) => {
            /*
              A trackpad and a touchscreen scroll this rail natively; a MOUSE
              wheel only scrolls vertically, so on a strip with no vertical
              overflow it does nothing at all and the chips past the edge are
              unreachable without dragging. Translating the dominant axis is
              what makes the same gesture work for every pointer.
            */
            const rail = event.currentTarget;
            if (rail.dataset['layout'] !== 'rail') return;
            if (rail.scrollWidth <= rail.clientWidth) return;
            const delta =
              Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (delta === 0) return;
            /*
              RTL reverses which way "forward" is, and `scrollLeft` follows the
              writing direction: in an Arabic panel it starts at 0 on the RIGHT
              and runs NEGATIVE leftward. Adding a positive delta there scrolls
              back toward the start you are already at — the rail simply refuses
              to move, in the language this product defaults to. `scrollBy` with
              a signed `left` is the same arithmetic, written once.
            */
            const rtl = getComputedStyle(rail).direction === 'rtl';
            rail.scrollBy({ left: rtl ? -delta : delta });
          }}
        >
          {suggestions.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="pg-chat__starter"
                disabled={busy}
                data-kind={entry.kind}
                lang={localeOf(entry.text)}
                dir="auto"
                /*
                  The chip truncates; the whole sentence stays reachable. The
                  accessible name is the full text (the span is the only content),
                  and `title` gives a sighted person the rest on hover.
                */
                title={entry.text}
                onClick={() => {
                  void ask(entry.text);
                }}
              >
                <span className="pg-chat__starter-icon" aria-hidden="true">
                  <IconPlus />
                </span>
                <span className="pg-chat__starter-text">{entry.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="pg-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <div className="pg-chat__composer-card" data-busy={busy ? '' : undefined}>
          {/* The aurora is DECORATION over the card's own edge, so it can
              animate while the assistant works without moving anything in the
              layout. Two layers, one gradient: the aura is the blurred halo,
              the glow is the crisp ring — split because the ring's mask would
              clip the halo if they shared an element. */}
          <span className="pg-chat__composer-aura" aria-hidden="true" />
          <span className="pg-chat__composer-glow" aria-hidden="true" />
          <label className="bldr-visually-hidden" htmlFor={inputId}>
            Ask the assistant
          </label>
          <textarea
            id={inputId}
            rows={2}
            value={draft}
            placeholder="Ask for a change…"
            enterKeyHint="send"
            disabled={busy}
            /* The field and its send button are ONE control, so the ring is
               drawn around the card by :focus-within. See the stylesheet. */
            data-bldr-focus-ring="delegated"
            onFocus={() => {
              setComposerFocused(true);
            }}
            onBlur={() => {
              setComposerFocused(false);
            }}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDraft(value);
              const caret = event.currentTarget.selectionStart;
              const match = MENTION_PATTERN.exec(value.slice(0, caret));
              setMentionQuery(match === null ? null : (match[1] ?? ''));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && mentionQuery !== null) {
                event.preventDefault();
                setMentionQuery(null);
                return;
              }
              // Enter sends, Shift+Enter writes a line — the convention every
              // chat uses, and the one a person's hands already know.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
          />
          {mentionQuery === null ? null : (
            <div className="pg-chat__mentions" role="listbox" aria-label="Mention a block">
              {mentionCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="pg-chat__mention"
                  onClick={() => {
                    pickMention(candidate.id);
                  }}
                >
                  <span className="pg-chat__mention-id">@{candidate.id}</span>
                  <span className="pg-chat__mention-type">{candidate.type}</span>
                  {candidate.excerpt === undefined ? null : (
                    <span className="pg-chat__mention-excerpt" dir="auto">
                      {candidate.excerpt}
                    </span>
                  )}
                </button>
              ))}
              {mentionCandidates.length === 0 ? (
                <p className="pg-chat__mention-empty">No matching block.</p>
              ) : null}
            </div>
          )}
          <div className="pg-chat__composer-actions">
            {/*
              The mode row, where Claude keeps its own: part of the composer,
              read before every send.

              LOCKED WHILE A RUN IS IN FLIGHT, and that is not a nicety.

              A run captures its mode when it starts, and the closure keeps it:
              a request begun in Auto carries `apply: 'auto'` all the way to
              `applyAiPlan`, and a build's scaffold, its fallback, its fills and
              their retries all apply unconditionally. Leaving this enabled
              meant a person could press Auto, see it thinking, change their
              mind to Plan — and watch the page be written anyway, by a run they
              had just told to stop writing. The same holds for the approval
              card: it resolves the promise the ORIGINAL run installed.

              Locking the control is the honest answer, because it is true:
              this run's authority was decided when it started, and the way to
              change it is Stop. Changing the label while the closure keeps the
              old authority would be the lie.
            */}
            <div
              className="pg-chat__modes"
              role="radiogroup"
              aria-label="Assistant mode"
              aria-disabled={busy ? true : undefined}
              /*
                The reason, where a keyboard or screen-reader user can reach it.
                It lived only in `title` on the disabled buttons, which neither
                can get to: a control that cannot be used and cannot say why is
                just broken as far as they can tell.
              */
              {...(busy ? { 'aria-describedby': modeLockId } : {})}
            >
              {MODES.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === candidate.id}
                  className="pg-chat__mode"
                  disabled={busy}
                  /*
                    ONE tab stop for the group, on the chosen mode — what
                    `role="radio"` promises. Three separate tab stops made the
                    composer's action row cost three presses to cross, and the
                    arrows below are the other half of the same promise: a
                    person told "radio group" reaches for them, and buttons do
                    not answer arrows on their own.
                  */
                  tabIndex={mode === candidate.id ? 0 : -1}
                  onKeyDown={(event) => {
                    const mirrored =
                      locale === 'ar' &&
                      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                        ? event.key === 'ArrowLeft'
                          ? 'ArrowRight'
                          : 'ArrowLeft'
                        : event.key;
                    const step =
                      mirrored === 'ArrowRight' || mirrored === 'ArrowDown'
                        ? 1
                        : mirrored === 'ArrowLeft' || mirrored === 'ArrowUp'
                          ? -1
                          : 0;
                    if (step === 0) return;
                    event.preventDefault();
                    const at = MODES.findIndex((entry) => entry.id === mode);
                    // Wraps, as a radio group does: the ends are not walls.
                    const next = MODES[(at + step + MODES.length) % MODES.length];
                    if (next === undefined) return;
                    setMode(next.id);
                    /*
                      Selection MOVES focus in a radio group — the newly chosen
                      option is the one tab stop, so leaving focus behind would
                      strand it on an element the browser will skip next time.
                    */
                    event.currentTarget.parentElement
                      ?.querySelector<HTMLButtonElement>(`[data-mode="${next.id}"]`)
                      ?.focus();
                  }}
                  data-mode={candidate.id}
                  onClick={() => {
                    setMode(candidate.id);
                  }}
                >
                  {candidate.label}
                </button>
              ))}
            </div>
            <ChromeButton
              variant="icon"
              tone="primary"
              size="sm"
              className="pg-chat__send"
              /* One slot, two verbs: while the assistant works, the send slot
                 IS the stop control — the same place the hand just was, and a
                 promise that a running request is never out of reach. */
              aria-label={busy ? 'Stop' : 'Send'}
              disabled={!busy && draft.trim().length === 0}
              onClick={() => {
                if (busy) {
                  stop();
                } else {
                  void ask(draft);
                }
              }}
            >
              {busy ? <IconStop /> : <IconSend />}
            </ChromeButton>
          </div>
        </div>
        {/* What the chosen mode will do, said out loud, beside the whole
            guarantee — in one line, where the decision is made. */}
        <p className="pg-chat__footnote">
          {/*
            While a run is in flight this line says WHY the modes are locked,
            instead of what the chosen mode does — which the person cannot act
            on until the run ends anyway.

            It lives here, and not among the buttons, because the first version
            put it inside the radiogroup: a three-line paragraph wedged between
            the modes and the Send button, wrapping over the action row and
            making the composer look broken. A one-line explanation belongs in
            the one-line place a person already reads for mode information.
          */}
          <span id={modeLockId} className="pg-chat__mode-hint">
            {busy
              ? 'Stop the request to change mode.'
              : MODES.find((candidate) => candidate.id === mode)?.hint}
          </span>
          <span className="pg-chat__guarantee">
            <IconShield />
            Whatever you apply is one entry in history, one undo.
          </span>
        </p>
      </form>

      {/*
        THE PREVIEW: the would-be page, rendered from the scratch rehearsal.
        Same static renderer the published path uses, same registry, zero
        writes — builder.io's accept-with-your-eyes-open pattern, through this
        kernel's own door.
      */}
      {preview === null ? null : (
        <div
          className="pg-chat__preview-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPreview(null);
            }
          }}
        >
          <div className="pg-chat__preview" role="dialog" aria-label="Preview" aria-modal="true">
            <header className="pg-chat__preview-head">
              <h3>Preview</h3>
              <p>How the page will look after this change. Nothing is applied yet.</p>
              <ChromeButton
                variant="icon"
                size="sm"
                aria-label="Close preview"
                onClick={() => {
                  setPreview(null);
                }}
              >
                <IconClose />
              </ChromeButton>
            </header>
            <div className="pg-chat__preview-page">
              <StaticDocument document={preview.document} blocks={kernel.context.registry.block} />
            </div>
            <footer className="pg-chat__preview-actions">
              {/*
                No Apply while the panel is planning. The dialog used to draw it
                unconditionally, so a proposal made in Ask could be applied from
                here after the person switched to Plan — the same page the panel
                was promising not to write. `accept` refuses anyway; not drawing
                the button is what stops it from being a broken promise on
                screen.
              */}
              {mode === 'plan' ? (
                <p className="pg-chat__preview-note">
                  Planning only — switch to Ask or Auto to apply this.
                </p>
              ) : (
                <ChromeButton
                  variant="primary"
                  onClick={() => {
                    accept(preview.id, preview.proposal);
                    setPreview(null);
                  }}
                >
                  <IconCheck />
                  Apply
                </ChromeButton>
              )}
              <ChromeButton
                variant="quiet"
                onClick={() => {
                  setPreview(null);
                }}
              >
                Close
              </ChromeButton>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
