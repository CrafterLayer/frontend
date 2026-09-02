import {
  useCallback,
  useEffect,
  useId,
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
  createMemoryContextProvider,
  GENERATION_STAGE_LABELS,
  GenerationProgress,
  previewAiPlan,
  runAiAgent,
  StaticDocument,
  systemClock,
  systemIds,
  type AiAgentEvent,
  type AiAgentPolicy,
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
import { initialRunProgress, reduceRunProgress, type RunProgress } from './AssistantPanel.progress';
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
}

/**
 * One turn. A plan belongs to its MESSAGE, not to a single "current plan" slot:
 * a person needs to see what was proposed three turns ago as readily as what
 * was proposed just now, and one slot forgets the moment you ask anything else.
 */
type Turn =
  | { readonly id: string; readonly from: 'you'; readonly text: string }
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
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'discarded';
    }
  | {
      readonly id: string;
      readonly from: 'assistant';
      readonly kind: 'plan';
      readonly plan: AiPlan;
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

/** One name, chosen by locale. Never both: a bilingual header reads as two people. */
const AGENT_NAME = { ar: 'أبو غضب', en: 'Abu Ghadab' } as const satisfies Record<
  AgentLocale,
  string
>;

const STARTERS = [
  'add a pricing section',
  'add a hero',
  'add a testimonials section',
  'add a call to action',
] as const;

const EMPTY_TURNS: readonly Turn[] = [];
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
      turns: session.turns.map((turn) => {
        if (turn.from === 'assistant' && turn.kind === 'thinking') {
          return { id: turn.id, from: 'assistant', kind: 'stopped' } as const;
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
    return { sessions: withUniqueTurnIds(sessions), activeId: parsed.activeId };
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
  persistKey,
  locale = 'ar',
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

  // Every settled change is written back; a blocked store fails silently — the
  // conversation still works, it just forgets on reload.
  useEffect(() => {
    if (persistKey === undefined) {
      return;
    }
    try {
      window.localStorage.setItem(persistKey, JSON.stringify({ sessions, activeId }));
    } catch {
      // Storage full or blocked: in-memory behaviour continues unchanged.
    }
  }, [activeId, persistKey, sessions]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('ask');
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

  // The newest turn is the one being read, so the thread follows it.
  useEffect(() => {
    const thread = threadRef.current;
    if (thread !== null) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [turns]);

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

  const ask = useCallback(
    async (request: string) => {
      const trimmed = request.trim();
      if (trimmed.length === 0 || busy) {
        return;
      }
      setBusy(true);
      setDraft('');
      const thinkingId = nextId('turn');
      // No spinner without a subject: the wait says what is being read.
      const subject = selectedType === undefined ? 'the page' : `the ${selectedType} block`;
      /*
        Appending the turns and naming the conversation are ONE update.
        Done as two, the rename ran after the turns were already in and its
        `turns.length === 0` test was never true again — every conversation
        stayed called "New chat" and the switcher listed them identically.
      */
      const youId = nextId('turn');
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeId
            ? {
                ...session,
                // The first thing asked names the conversation, as a chat should.
                title: session.turns.length === 0 ? trimmed.slice(0, 32) : session.title,
                turns: [
                  ...session.turns,
                  { id: youId, from: 'you', text: trimmed },
                  {
                    id: thinkingId,
                    from: 'assistant',
                    kind: 'thinking',
                    subject,
                    run: initialRunProgress(mode === 'auto' ? 'auto' : 'never', systemClock.now()),
                  },
                ],
              }
            : session,
        ),
      );

      /*
        The conversation IS the context: what was asked and what the assistant
        answered, oldest first, capped so an old chat cannot crowd out the
        document. Thinking bubbles and stop markers carry no meaning here.
      */
      const history: AiChatTurn[] = (active?.turns ?? [])
        .flatMap<AiChatTurn>((turn) => {
          if (turn.from === 'you') {
            return [{ role: 'user', text: turn.text }];
          }
          if (turn.kind === 'plan') {
            return [{ role: 'assistant', text: turn.plan.rationale }];
          }
          if (turn.kind === 'refused') {
            return [{ role: 'assistant', text: turn.text }];
          }
          return [];
        })
        .slice(-12);

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
          skillRegistry: skillRegistry ?? DEFAULT_AI_SKILL_REGISTRY,
          ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
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
                  ...(turn.from === 'assistant' && turn.kind === 'thinking'
                    ? { run: turn.run }
                    : {}),
                }
              : turn,
          ),
        );
        settleFaceTurn({ runId, outcome: 'plan', applied: result.status === 'applied' });
      } catch (cause: unknown) {
        if (controller.signal.aborted) {
          // The person pressed Stop. That is an outcome, not an error.
          patchTurns((previous) =>
            previous.map((turn) =>
              turn.id === thinkingId ? { id: turn.id, from: 'assistant', kind: 'stopped' } : turn,
            ),
          );
          settleFaceTurn({ runId, outcome: 'stopped' });
        } else {
          const failure = classifyAiRunFailure(cause);
          patchTurns((previous) =>
            previous.map((turn) =>
              turn.id === thinkingId
                ? {
                    id: turn.id,
                    from: 'assistant',
                    kind: 'refused',
                    text: failure.message,
                    failure,
                    request: trimmed,
                    ...(turn.from === 'assistant' &&
                    turn.kind === 'thinking' &&
                    turn.run.failedAt !== null
                      ? { failedAt: turn.run.failedAt }
                      : {}),
                  }
                : turn,
            ),
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
      activeId,
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
      patchTurns,
      planProvider,
      providerKind,
      selectedSkillIds,
      selectedType,
      settleFaceTurn,
      skillRegistry,
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
    [kernel, memory, noteFaceTurn, patchTurns],
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

  /** Rehearse the plan on a scratch kernel and show the result. Looking ≠ applying. */
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
            <ul className="pg-chat__starters">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    className="pg-chat__starter"
                    onClick={() => {
                      void ask(starter);
                    }}
                  >
                    <span className="pg-chat__starter-icon" aria-hidden="true">
                      <IconPlus />
                    </span>
                    <span className="pg-chat__starter-text">{starter}</span>
                  </button>
                </li>
              ))}
            </ul>
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
                    {...(turn.kind === 'thinking'
                      ? { mood: face.mood, variant: face.variant }
                      : moodForTurn(turn))}
                  />
                </span>
                <div className="pg-chat__reply-body">
                  {turn.kind === 'thinking' ? (
                    <div className="pg-chat__inflight" data-state="inflight">
                      {/* The rows narrate; the panel's own voice is the ONE live
                        region, so the card stays silent. No Cancel here: the
                        composer's Stop is the one abort. */}
                      <GenerationProgress
                        heading={`Working on ${turn.subject}`}
                        stages={turn.run.stages}
                        announce={false}
                      />
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
                  {turn.kind === 'stopped' ? (
                    <div className="pg-chat__card pg-chat__card--discarded" data-state="stopped">
                      <p className="pg-chat__refused">Stopped.</p>
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
                            {turn.failedAt === undefined
                              ? ''
                              : ` · at ${GENERATION_STAGE_LABELS[turn.failedAt]}`}
                          </p>
                        )}
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
                        </p>
                      ) : (
                        <div className="pg-chat__decide">
                          {/* A plan proposed in Plan mode never offers Apply:
                            exploring must not be one misclick from writing. */}
                          {(turn.mode ?? 'ask') === 'plan' || turn.proposal === undefined ? null : (
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
                      {/* The plan's own "and next…" — staged work as one tap,
                        never applied automatically. */}
                      {turn.plan.followUp === undefined ? null : (
                        <ChromeButton
                          variant="quiet"
                          size="sm"
                          className="pg-chat__continue"
                          disabled={busy}
                          onClick={() => {
                            void ask(turn.plan.followUp ?? '');
                          }}
                        >
                          <IconSparkle />
                          <span className="pg-chat__continue-text" dir="auto">
                            {turn.plan.followUp}
                          </span>
                        </ChromeButton>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

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
            {/* The mode row, where Claude keeps its own: part of the composer,
                read before every send. */}
            <div className="pg-chat__modes" role="radiogroup" aria-label="Assistant mode">
              {MODES.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === candidate.id}
                  className="pg-chat__mode"
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
          <span className="pg-chat__mode-hint">
            {MODES.find((candidate) => candidate.id === mode)?.hint}
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
