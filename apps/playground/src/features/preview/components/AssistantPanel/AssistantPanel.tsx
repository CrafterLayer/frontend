import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  applyAiPlan,
  classifyAiRunFailure,
  createCraftkitAiSkillRegistry,
  createDirectPlanProvider,
  createLocalAiPlanProvider,
  outlineAiPlan,
  previewAiPlan,
  runAiAgent,
  runAiBuild,
  systemClock,
  type AiAgentEvent,
  type AiAgentPolicy,
  type AiBuildOwnEvent,
  type AiPlanProvider,
  type AiSkillRegistry,
  type AiValidatedProposal,
  type BuilderDocument,
  type BuilderKernel,
  type NodeId,
} from '@craftkit/builder';

import { useAgentMood, type AgentLocale } from '../AgentFace';
import { AgentContextBar } from '../AgentContextBar';
import { AgentDockHeader } from '../AgentDockHeader';
import { AssistantComposer } from '../AssistantComposer';
import { AssistantThread } from '../AssistantThread';
import { QueuedRequestCard, type QueuedRequestState } from '../QueuedRequestCard';
import { estimateRequestTokens } from './AssistantPanel.impact';
import { useAppliedChangeMemory } from './AssistantPanel.memory';
import { insertMention, mentionCandidatesFor, mentionedIds } from './AssistantPanel.mentions';
import { panelSuggestions } from './AssistantPanel.suggestions';
/*
  The RUN layer: who owns the active run, which requests route to a build, which
  skills a mode carries, and how a proposal is rehearsed. None of it renders.
*/
import {
  activatesBuildArchetype,
  blocksAtVersion,
  impactOfProposal,
  isBuildOwnEvent,
  lastDropped,
  lastFollowUp,
  ownsRun,
  preflightPorts,
  retrySkippedRequest,
  skillsForMode,
  withImpact,
  type ActiveRunLease,
} from './AssistantPanel.runs';
/*
  The conversation's DATA layer: what a turn is, what a session is, and how both
  survive a reload. Moved out of this file because none of it renders anything —
  and because the revival rules are the kind of thing that has to be readable on
  their own to stay correct.
*/
import {
  highestIdSuffix,
  historyOf,
  reviveSessions,
  type BuildingTurn,
  type PlanTurn,
  type Session,
  type Turn,
} from './AssistantPanel.turns';
/*
  Re-exported, not re-declared: `AssistantMode` is part of this panel's public
  surface and its data now lives beside the control that renders it.
*/
export { MODES, type AssistantMode } from './AssistantPanel.modes';
import type { AssistantMode } from './AssistantPanel.modes';
import type { SiteRunSeam } from './use-site-run';
import { PlanPreviewDialog } from '../PlanPreviewDialog';
import { SuggestionRail } from '../SuggestionRail';
import {} from './AssistantPanel.icons';
import {
  buildReceipt,
  initialBuildProgress,
  reduceBuildProgress,
  taskTransactionLabel,
} from './AssistantPanel.build';
import {
  appendLiveProgress,
  initialRunProgress,
  receiptOf,
  reduceRunProgress,
} from './AssistantPanel.progress';
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
  /** Models the header may offer, the current one, and the host's setter. Fewer than two ⇒ no picker. */
  models?: readonly string[] | undefined;
  model?: string | undefined;
  onSelectModel?: ((model: string) => void) | undefined;
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
   * The mode a person starts in until they choose one; a chosen mode is
   * remembered and wins. Default 'ask'. The product passes 'auto': every
   * change lands as undoable history, so a person who asked for a page gets
   * the page without an extra Apply.
   */
  defaultMode?: AssistantMode | undefined;
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
  /**
   * Hands the host this panel's ONE run lease.
   *
   * The site builder is its own rail destination — a build is a job, not a
   * message — but it must not be able to start a run while this panel owns one.
   * Sharing the lease rather than duplicating it is what makes that structural:
   * there is one `activeRunRef`, one `busy`, and one `stop`, whichever
   * destination a person is looking at.
   */
  onSiteSeam?: ((seam: SiteRunSeam) => void) | undefined;
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
/**
 * Ask again for the sections a build gave up on — and ONLY those.
 *
 * Deliberately worded without any page noun: the routing above reads the same
 * registry, and a retry that said "landing page" again would scaffold a second
 * skeleton over the one already on the canvas.
 */
/*
  The four hardcoded English sentences that used to live here are gone.

  They were wrong three ways at once: English only, in a product whose default
  locale is Arabic; unrelated to the blocks this build actually registered; and
  shown ONLY before the first message, so a person who wrote one thing and
  paused was left with an empty box and a blinking cursor. Suggestions are now
  derived — see `AssistantPanel.suggestions.ts` — and they never run out.
*/

const EMPTY_TURNS: readonly Turn[] = [];

/**
 * The blocks a kernel holds, as of a given registry version.
 *
 * The version is an argument it does not use, and that is the point: the
 * registry is mutable and hands back the same object identity after an
 * extension registers, so a memo keyed on the kernel alone never learns that
 * the catalog grew. Threading the version through a real parameter is what
 * turns "please re-run" into a dependency the compiler and the linter can both
 * see.
 */
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
const DEFAULT_AI_SKILL_REGISTRY = createCraftkitAiSkillRegistry();

/**
 * Where a request came from, which decides whether the CATALOG may answer it.
 *
 * `suggestion` means the person pressed a chip carrying a catalog prompt
 * verbatim; `typed` means they wrote it, even if it happens to read the same.
 * The difference is not cosmetic: one is picking a named example, the other is
 * asking for something for this page.
 *
 * `build` is a planned page being built for real. It is its own origin because
 * it must not be answered from the catalog — the request is a page, not an
 * example — and because the mode control has just moved beneath it.
 */
type AskOrigin = 'typed' | 'suggestion' | 'build';

interface QueuedAssistantRequest {
  readonly request: string;
  readonly context: string;
  readonly selection: readonly NodeId[];
  readonly targetTypes: readonly (string | undefined)[];
  readonly state: QueuedRequestState;
}

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
  defaultMode = 'ask',
  locale = 'ar',
  visible = true,
  onSiteSeam,
  models: offeredModels,
  model: chosenModel,
  onSelectModel,
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
  const [modeChosen, setModeChosen] = useState(
    () => reviveSessions(persistKey)?.modeChosen === true,
  );
  const [panelMode, setMode] = useState<AssistantMode>(() => {
    const revived = reviveSessions(persistKey);
    const saved = revived?.mode;
    /*
      Only a mode the person chose outlives the host default. Anything else —
      a default saved like a choice, older data, a hand-edited store — reads
      as the host default.
    */
    if (revived?.modeChosen !== true) return defaultMode;
    return saved === 'auto' || saved === 'plan' || saved === 'ask' ? saved : defaultMode;
  });
  const chooseMode = useCallback((mode: AssistantMode) => {
    setModeChosen(true);
    setMode(mode);
  }, []);

  // Every settled change is written back; a blocked store fails silently — the
  // conversation still works, it just forgets on reload.
  useEffect(() => {
    if (persistKey === undefined) {
      return;
    }
    try {
      window.localStorage.setItem(
        persistKey,
        JSON.stringify({ sessions, activeId, mode: panelMode, modeChosen }),
      );
    } catch {
      // Storage full or blocked: in-memory behaviour continues unchanged.
    }
  }, [activeId, modeChosen, panelMode, persistKey, sessions]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [queuedRequest, setQueuedRequest] = useState<QueuedAssistantRequest | null>(null);
  const [queuePaused, setQueuePaused] = useState(false);
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
  } = useAgentMood({ mode: panelMode, composerFocused, draftLength: draft.length });
  // He watches you cross the header (or the empty state) — never while you type.
  const { watchZone: watchHeadZone, holdSeat: holdHeadSeat } = useFaceLook();
  const { watchZone: watchEmptyZone, holdSeat: holdEmptySeat } = useFaceLook();
  /** The @-mention in progress: the text typed after the trailing @, or null. */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  /** A lease and controller for the one run allowed to own this panel. */
  const activeRunRef = useRef<ActiveRunLease | null>(null);
  /**
   * The pending answer to a build's ONE question. A ref, not state: it is the
   * continuation of a promise the orchestrator is awaiting, and putting it in
   * state would re-render the panel to store something no view reads.
   */
  const approvalRef = useRef<((answer: 'build' | 'stop') => void) | null>(null);
  const memory = useAppliedChangeMemory();
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
  const inputId = useId();
  const modeLockId = useId();
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
  /*
    Keyed on the SCALAR follow-up, not on the whole conversation.

    `turns` changes on every streamed progress tick — a build emits dozens — and
    the derivation walks the entire block registry each time. In the playground
    that is the full marketing catalog, and it was enough to slow a held build
    story past its timeout: work proportional to the catalog, repeated at the
    rate the model narrates.

    The registry's version is a dependency for the opposite reason: the catalog
    is MUTABLE. An extension registered at runtime adds blocks, and without
    reading the version the strip kept offering the old ones until some
    unrelated turn or selection happened to invalidate the memo.
  */
  const catalogVersion = kernel.extensions.version();

  /** Whoever was wired in, or the deterministic local one when nobody was. */
  const resolvedProvider = useMemo(
    () => planProvider ?? createLocalAiPlanProvider(),
    [planProvider],
  );

  /**
   * The same provider with the CATALOG in front of it.
   *
   * Used for one case and one only: the person pressed a suggestion carrying a
   * catalog prompt verbatim. The catalog already holds the node that prompt
   * produces, so there is nothing to guess — asking a model would spend a round
   * trip and tokens to be told a value this build is holding, and might be told
   * something else.
   *
   * TYPED text never reaches this, even when it happens to read the same. A
   * person who wrote "add a hero" in their own words is asking for a hero for
   * THEIR page, and answering with the catalog's demo copy would be a fast
   * wrong answer. Pressing the chip is picking the example by name; typing is
   * not.
   *
   * The plan it returns is an ordinary plan: same door, same proposal, same
   * dispatch. An example that stopped validating is refused exactly as a
   * model's plan would be.
   */
  const catalogFirstProvider = useMemo(
    () =>
      createDirectPlanProvider({
        /*
          The SAME catalog the suggestions were derived from, read at propose
          time so a registered extension is visible immediately. Reading it off
          the assembled context instead would answer a chip on one run and stop
          on the next, because a context carries examples in `full` mode alone.
        */
        catalog: () =>
          blocksAtVersion(kernel, catalogVersion).map(({ schema }) => ({
            type: schema.type,
            examples: schema.examples,
          })),
        fallback: resolvedProvider,
      }),
    [kernel, catalogVersion, resolvedProvider],
  );

  const followUp = lastFollowUp(turns);
  const dropped = lastDropped(turns);
  const suggestions = useMemo(
    () =>
      panelSuggestions({
        /*
          `catalogVersion` is READ here, not merely listed as a dependency. The
          registry is mutable and returns the same object identity after an
          extension is registered, so nothing else in this closure changes when
          the catalog grows — passing the version through the boundary is what
          makes the dependency real rather than a promise to the linter.
        */
        blocks: blocksAtVersion(kernel, catalogVersion),
        selected:
          selectedType === undefined
            ? undefined
            : kernel.context.registry.block(selectedType)?.schema,
        followUp,
        ...(dropped === undefined ? {} : { dropped }),
        locale,
      }),
    [kernel, selectedType, followUp, dropped, catalogVersion, locale],
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
    setQueuedRequest(null);
    setQueuePaused(false);
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
    async (trimmed: string, mode: AssistantMode) => {
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
          provider: resolvedProvider,
          request: trimmed,
          validationPorts: preflightPorts(),
          selection,
          history,
          ...(memory.hasRecords() ? { additionalContextProviders: [memoryProvider] } : {}),
          skillRegistry: registry,
          ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
          ...catalogPolicyFor(providerKind, selection, agentPolicy),
          /*
            PLAN never writes, here as everywhere else. The build stops at the
            skeleton, proposes it instead of applying it, and reports the
            sections it would have filled.
          */
          ...(mode === 'plan' ? { apply: 'never' as const } : {}),
          /*
            Ask waits on the list; Auto does not wait at all. An `onPlanned`
            that always answered 'build' would be the same behaviour with a lie
            in the middle, so Auto omits the hook entirely. Plan is never asked:
            there is nothing to approve when nothing will be written.
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

        if (result.outcome === 'planned') {
          /*
            PLAN MODE reached the build path and stopped at the skeleton.

            The card is an outline, not a build report: nothing was written, no
            section was filled, and there is nothing to undo. What it adds over
            an ordinary outline is the section LIST the skeleton proposed, and
            one action to build it for real — as a new run, at an authority this
            one never had.
          */
          patchTurns((previous) =>
            previous.map((turn): Turn =>
              turn.id === buildId
                ? {
                    id: turn.id,
                    from: 'assistant',
                    kind: 'outline',
                    text: result.direction,
                    dropped: 0,
                    sections: (result.plannedTasks ?? []).map((task) => task.title),
                    request: trimmed,
                    ...(result.scaffold === undefined
                      ? {}
                      : { skills: result.scaffold.proposal.skillActivations }),
                  }
                : turn,
            ),
          );
          settleFaceTurn({ runId, outcome: 'plan', applied: false });
          return;
        }

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
      nextId,
      onAgentEvent,
      onBuildEvent,
      onFaceEvent,
      openTurn,
      patchTurns,
      resolvedProvider,
      providerKind,
      registry,
      selectedSkillIds,
      settleFaceTurn,
    ],
  );

  const ask = useCallback(
    async (
      request: string,
      origin: AskOrigin = 'typed',
      capturedSelection?: readonly NodeId[],
    ) => {
      const trimmed = request.trim();
      /*
        The mode this RUN carries, which is not always the one in state.
        `setMode` is asynchronous and this closure already holds the old value,
        so a build started from a planned page would otherwise plan again — the
        control would move and nothing would happen. Deciding it here keeps the
        run's authority and the visible control saying the same thing, which is
        the property the mode lock exists to protect.
      */
      const mode: AssistantMode = origin === 'build' ? 'ask' : panelMode;
      if (trimmed.length === 0) {
        return;
      }
      if (busy) {
        if (queuedRequest !== null) return;
        const selection = kernel.context.store.getState().selection;
        setQueuedRequest({
          request: trimmed,
          context: sees,
          selection,
          targetTypes: selection.map((id) => kernel.getDocument().nodes[id]?.type),
          state: 'editable',
        });
        setQueuePaused(false);
        setDraft('');
        return;
      }
      setQueuePaused(false);
      /*
        A PAGE is a build; a section is one call. Plan mode never builds: the
        skeleton would apply, and Plan must never apply. Everything else takes
        the path it took before this branch existed.
      */
      if (activatesBuildArchetype(registry, trimmed)) {
        await runBuild(trimmed, mode);
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
      /** What the recovery ladder left behind, if it ran at all. */
      let salvaged: PlanTurn['salvaged'];
      // Entered synchronously, so Send is answered before the run's first event.
      beginFaceRun(runId, subject);
      /*
        @mentions ARE the selection: naming a block in the request is the most
        direct way a person points at it, so named blocks (that really exist)
        replace the canvas selection as the request's focus.
      */
      const mentioned = mentionedIds(trimmed, kernel.getDocument());
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
            provider: resolvedProvider,
            request: trimmed,
            selection:
              mentioned.length > 0
                ? mentioned
                : (capturedSelection ?? kernel.context.store.getState().selection),
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
          provider: origin === 'suggestion' ? catalogFirstProvider : resolvedProvider,
          request: trimmed,
          validationPorts: preflightPorts(),
          selection:
            mentioned.length > 0
              ? mentioned
              : (capturedSelection ?? kernel.context.store.getState().selection),
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
            /*
              A LOCAL, not state: the salvage is read once, at the end, to build
              the card. Putting it in state would re-render the panel mid-run to
              store something no view reads until the run is over — and a run
              salvages at most once, so there is nothing to accumulate.
            */
            if (event.type === 'plan.salvaged') {
              salvaged = { kept: event.kept, dropped: event.dropped };
            }
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
                const progressLog =
                  event.type === 'plan.progress'
                    ? appendLiveProgress(turn.progressLog, event.text)
                    : turn.progressLog;
                if (
                  event.type === 'plan.progress' &&
                  run === turn.run &&
                  turn.progress === event.text &&
                  progressLog === turn.progressLog
                ) {
                  return turn;
                }
                return {
                  ...turn,
                  run,
                  ...(event.type === 'plan.progress'
                    ? {
                        progress: event.text,
                        progressLog,
                      }
                    : {}),
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
                  ...(salvaged === undefined ? {} : { salvaged }),
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
      catalogFirstProvider,
      kernel,
      memory,
      memoryProvider,
      panelMode,
      queuedRequest,
      nextId,
      onAgentEvent,
      onFaceEvent,
      openTurn,
      patchTurns,
      resolvedProvider,
      providerKind,
      registry,
      runBuild,
      selectedSkillIds,
      selectedType,
      sees,
      settleFaceTurn,
    ],
  );

  useEffect(() => {
    if (busy || queuePaused || queuedRequest === null || queuedRequest.state === 'missing-target') {
      return;
    }
    const nodes = kernel.getDocument().nodes;
    const missingTarget = queuedRequest.selection.some(
      (id, index) => nodes[id]?.type !== queuedRequest.targetTypes[index],
    );
    if (missingTarget) {
      setQueuedRequest((current) =>
        current === null ? null : { ...current, state: 'missing-target' },
      );
      return;
    }
    const next = queuedRequest;
    setQueuedRequest(null);
    void ask(next.request, 'typed', next.selection);
  }, [ask, busy, kernel, queuePaused, queuedRequest]);

  const stop = useCallback(() => {
    if (queuedRequest !== null) setQueuePaused(true);
    activeRunRef.current?.controller.abort();
  }, [queuedRequest]);

  /**
   * The panel's ONE lease, handed to the site run rather than duplicated.
   *
   * Load-bearing: a site run and a page run take the same lease, so two runs
   * can never both believe they own `busy`, and `stop` aborts whichever is
   * going without knowing which kind it is.
   */
  const siteSeam = useMemo<SiteRunSeam>(
    () => ({
      busy,
      claim: (runId, controller) => {
        if (activeRunRef.current !== null) return false;
        activeRunRef.current = { runId, controller };
        setBusy(true);
        return true;
      },
      release: (runId) => {
        if (ownsRun(activeRunRef.current, runId)) {
          activeRunRef.current = null;
          setBusy(false);
        }
      },
      stop: () => {
        activeRunRef.current?.controller.abort();
      },
    }),
    [busy],
  );
  /*
    Handed UP, not consumed here. The site builder lives on its own rail
    destination now, and the two share this one lease so a site build and a page
    request can never both believe they own the editor.
  */
  useEffect(() => {
    onSiteSeam?.(siteSeam);
  }, [onSiteSeam, siteSeam]);

  /** Every block a trailing @ can point at, filtered as the person types. */
  const mentionCandidates = mentionCandidatesFor(kernel.getDocument(), mentionQuery);

  const pickMention = useCallback(
    (id: string) => {
      setDraft((current) => insertMention(current, mentionQuery, id));
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
      if (panelMode === 'plan') {
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
    [kernel, memory, panelMode, noteFaceTurn, patchTurns],
  );

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
  const mutatesLiveDocument = panelMode !== 'plan';

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
      <AgentDockHeader
        locale={locale}
        face={face}
        conversations={sessions.map((session) => ({
          id: session.id,
          title: session.title,
          turnCount: session.turns.length,
        }))}
        activeId={activeId}
        onSelectConversation={setActiveId}
        onNewChat={startNewChat}
        watchZone={watchHeadZone}
        holdSeat={holdHeadSeat}
      />

      <AgentContextBar
        scope={selectedType === undefined ? 'page' : 'instance'}
        label={`Sees: ${sees}`}
        detail={selectedId}
      />

      <AssistantThread
        turns={turns}
        face={face}
        locale={locale}
        mode={panelMode}
        busy={busy}
        canWrite={mutatesLiveDocument}
        threadRef={threadRef}
        watchEmptyZone={watchEmptyZone}
        holdEmptySeat={holdEmptySeat}
        onApproval={answerApproval}
        onStop={stop}
        onUndoTask={undoTask}
        onRetrySkipped={(titles) => {
          void ask(retrySkippedRequest(titles));
        }}
        onRetry={(request) => {
          void ask(request);
        }}
        onJump={(id) => {
          /*
            Selecting is the jump. The canvas scrolls to the selection and the
            Inspector follows, so one door does the whole thing — and it is the
            same door a click on the canvas uses, which is why a jumped-to
            section behaves exactly like one the person found themselves.
          */
          kernel.setSelection([id]);
        }}
        onBuild={(request) => {
          /*
            The mode control MOVES, and it moves first. A run's authority is
            fixed when it starts, so building a planned page means starting a
            run in a writing mode — and the panel must not be in one state while
            the run it just started is in another. Ask, not Auto: the person
            asked to plan, and the section list still gets its one approval.
          */
          setMode('ask');
          void ask(request, 'build');
        }}
        onApplyPlan={accept}
        onPreviewPlan={openPreview}
        onDiscardPlan={discard}
        onUndoPlan={() => {
          kernel.undo();
        }}
        onReviewAsCode={onReviewAsCode}
      />

      {/*
        The suggestion strip, ABOVE the composer and outside the thread.

        Outside, because it is not part of the conversation: putting it in the
        log made it scroll away with the messages, which is how the old starters
        disappeared after the first turn and never came back. Above the composer
        is where the next thing a person says is being decided.
      */}
      {/*
        The rail is its own component. Its two layouts, its wheel handling and
        its RTL sign live with it — this panel decides only WHAT to offer and
        what happens when one is picked.
      */}
      {turns.length === 0 && !busy ? (
        <SuggestionRail
          suggestions={suggestions}
          layout="stack"
          busy={false}
          onPick={(text) => {
            void ask(text, 'suggestion');
          }}
        />
      ) : null}

      {queuedRequest === null ? null : (
        <QueuedRequestCard
          request={queuedRequest.request}
          context={queuedRequest.context}
          state={queuedRequest.state}
          paused={queuePaused}
          onChange={(request) => {
            setQueuedRequest((current) => current === null ? null : { ...current, request });
          }}
          onRemove={() => {
            setQueuedRequest(null);
            setQueuePaused(false);
          }}
          onRun={() => {
            const selection = kernel.context.store.getState().selection;
            setQueuedRequest((current) =>
              current === null
                ? null
                : {
                    ...current,
                    context: sees,
                    selection,
                    targetTypes: selection.map((id) => kernel.getDocument().nodes[id]?.type),
                    state: 'editable',
                  },
            );
            setQueuePaused(false);
          }}
        />
      )}

      <AssistantComposer
        draft={draft}
        onDraftChange={setDraft}
        inputId={inputId}
        busy={busy}
        queued={queuedRequest !== null}
        onSend={() => {
          void ask(draft);
        }}
        onStop={stop}
        onFocusChange={setComposerFocused}
        mentionQuery={mentionQuery}
        onMentionQueryChange={setMentionQuery}
        mentionCandidates={mentionCandidates}
        onPickMention={pickMention}
        mode={panelMode}
        onModeChange={chooseMode}
        modeLockId={modeLockId}
        locale={locale}
        models={offeredModels}
        model={chosenModel}
        onSelectModel={onSelectModel}
      />

      {/*
        THE PREVIEW: the would-be page, rendered from the scratch rehearsal.
        Same static renderer the published path uses, same registry, zero
        writes — builder.io's accept-with-your-eyes-open pattern, through this
        kernel's own door.
      */}
      {preview === null ? null : (
        <PlanPreviewDialog
          document={preview.document}
          blocks={kernel.context.registry.block}
          /*
            The PANEL's promise, not the proposal's: in Plan mode nothing here
            writes, so the dialog draws the reason instead of a button `accept`
            would refuse to honour.
          */
          canApply={mutatesLiveDocument}
          onApply={() => {
            accept(preview.id, preview.proposal);
            setPreview(null);
          }}
          onClose={() => {
            setPreview(null);
          }}
        />
      )}
    </section>
  );
}
