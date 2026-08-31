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
  BUILDER_AI_CONTEXT_PROVIDERS,
  ChromeButton,
  createLocalAiPlanProvider,
  createMemoryContextProvider,
  generateAiPlan,
  previewAiPlan,
  StaticDocument,
  systemClock,
  systemIds,
  type AiChatTurn,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanStep,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';

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

export interface AssistantPanelProps {
  kernel: BuilderKernel;
  /** Opens the code view on the proposal. Absent ⇒ the action is not offered. */
  onReviewAsCode?: (() => void) | undefined;
  /** Optional proposal source for an embedded or deterministic host. */
  planProvider?: AiPlanProvider | undefined;
  /**
   * localStorage key for reviving conversations across reloads. Absent ⇒ the
   * panel stays fully in-memory (the portable default: the engine never
   * assumes a browser store; the HOST opts in).
   */
  persistKey?: string | undefined;
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
      readonly applied: boolean;
      /** The mode this plan was proposed under; absent (revived old data) reads as 'ask'. */
      readonly mode?: AssistantMode;
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

/** Four openers, each a request that works exactly as written. */
const STARTERS = [
  'add a pricing section',
  'add a hero',
  'add a testimonials section',
  'add a call to action',
] as const;

const EMPTY_TURNS: readonly Turn[] = [];

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

function kernelReason(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'I could not turn that into a change.';
}

function argText(args: unknown, key: string): string | undefined {
  if (typeof args !== 'object' || args === null) {
    return undefined;
  }
  const value = (args as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * The words a person reads for one step. The provider's own title wins — it
 * speaks the requester's language — and every builtin command still has a
 * plain-English fallback, so a step is never announced as its function name.
 */
function describeStep(step: AiPlanStep): string {
  if (step.title !== undefined) {
    return step.title;
  }
  const type = argText(step.args, 'type');
  const id = argText(step.args, 'id');
  const key = argText(step.args, 'key');
  switch (step.command) {
    case 'insertNode':
      return `Add ${type ?? 'a block'}`;
    case 'setProp':
      return `Change ${key ?? 'a property'} of ${id ?? 'a block'}`;
    case 'removeNode':
      return `Remove ${id ?? 'a block'}`;
    case 'moveNode':
      return `Move ${id ?? 'a block'}`;
    case 'duplicateNode':
      return `Duplicate ${id ?? 'a block'}`;
    case 'wrapNode':
      return `Wrap ${id ?? 'a block'} in ${argText(step.args, 'wrapperType') ?? 'a container'}`;
    case 'groupNodes':
      return `Group blocks into ${argText(step.args, 'groupType') ?? 'a group'}`;
    case 'setBinding':
      return `Bind ${key ?? 'a property'} of ${id ?? 'a block'}`;
    case 'setResponsive':
      return `Adjust ${key ?? 'a property'} per breakpoint on ${id ?? 'a block'}`;
    default:
      return step.command;
  }
}

interface PersistedPanelState {
  readonly sessions: readonly Session[];
  readonly activeId: string;
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
      turns: session.turns.map((turn) =>
        turn.from === 'assistant' && turn.kind === 'thinking'
          ? ({ id: turn.id, from: 'assistant', kind: 'stopped' } as const)
          : turn,
      ),
    }));
    return { sessions, activeId: parsed.activeId };
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
export function AssistantPanel({ kernel, onReviewAsCode, planProvider, persistKey }: AssistantPanelProps) {
  const counter = useRef(1);
  const nextId = useCallback((prefix: string) => {
    counter.current += 1;
    return `${prefix}-${String(counter.current)}`;
  }, []);

  const [sessions, setSessions] = useState<readonly Session[]>(
    () => reviveSessions(persistKey)?.sessions ?? [{ id: 'session-1', title: 'New chat', turns: [] }],
  );
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
  /** The @-mention in progress: the text typed after the trailing @, or null. */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  /** The running request's controller; present exactly while `busy`. */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * WHAT WAS ACTUALLY BUILT: the rationale of every applied plan, in order.
   * Fed back to the planner as a "Session memory" context fragment, so the
   * assistant knows the page's story — not only its current shape.
   */
  const [memory] = useState(() => {
    // A plain mutable list, owned by the closure — deliberately NOT state:
    // notes feed the next request's context, they never drive a render.
    const notes: string[] = [];
    return {
      note: (text: string) => {
        notes.push(text);
        if (notes.length > 20) {
          notes.shift();
        }
      },
      provider: createMemoryContextProvider({ load: () => [...notes] }),
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
    plan: AiPlan;
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
    const id = nextId('session');
    setSessions((previous) => [...previous, { id, title: 'New chat', turns: [] }]);
    setActiveId(id);
    setDraft('');
  }, [nextId]);

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
                  { id: thinkingId, from: 'assistant', kind: 'thinking', subject },
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

      const controller = new AbortController();
      abortRef.current = controller;
      /*
        @mentions ARE the selection: naming a block in the request is the most
        direct way a person points at it, so named blocks (that really exist)
        replace the canvas selection as the request's focus.
      */
      const mentioned = [...trimmed.matchAll(MENTION_IDS)]
        .map((match) => match[1] ?? '')
        .filter((id) => kernel.getDocument().nodes[id] !== undefined);
      try {
        const plan = await generateAiPlan({
          kernel,
          provider: planProvider ?? createLocalAiPlanProvider(),
          request: trimmed,
          validationPorts: preflightPorts(),
          selection: mentioned.length > 0 ? mentioned : kernel.context.store.getState().selection,
          history,
          contextProviders: [...BUILDER_AI_CONTEXT_PROVIDERS, memoryProvider],
          signal: controller.signal,
          // The provider's narration lands ON the thinking turn, so the wait
          // reads as work in progress rather than as a frozen spinner.
          onProgress: (progress) => {
            patchTurns((previous) =>
              previous.map((turn) =>
                turn.id === thinkingId && turn.from === 'assistant' && turn.kind === 'thinking'
                  ? { ...turn, progress }
                  : turn,
              ),
            );
          },
        });
        // Auto mode: the validated plan goes straight through the grouped
        // door — one atomic transaction, one undo — and the card lands already
        // applied. Any apply failure falls to the same catch as a rejection.
        if (mode === 'auto') {
          applyAiPlan({ kernel, plan, validationPorts: preflightPorts() });
          memory.note(plan.rationale);
        }
        const applied = mode === 'auto';
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === thinkingId
              ? { id: turn.id, from: 'assistant', kind: 'plan', plan, applied, mode }
              : turn,
          ),
        );
      } catch (cause: unknown) {
        if (controller.signal.aborted) {
          // The person pressed Stop. That is an outcome, not an error.
          patchTurns((previous) =>
            previous.map((turn) =>
              turn.id === thinkingId ? { id: turn.id, from: 'assistant', kind: 'stopped' } : turn,
            ),
          );
        } else {
          // The refusal prints the RULE, not a soft apology: when the kernel
          // refuses the assistant, a person is owed the name of what refused it.
          const text = kernelReason(cause);
          patchTurns((previous) =>
            previous.map((turn) =>
              turn.id === thinkingId
                ? { id: turn.id, from: 'assistant', kind: 'refused', text }
                : turn,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [active, activeId, busy, kernel, memory, memoryProvider, mode, nextId, patchTurns, planProvider, selectedType],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
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
    (id: string, plan: AiPlan) => {
      try {
        applyAiPlan({ kernel, plan, validationPorts: preflightPorts() });
        memory.note(plan.rationale);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? { ...turn, applied: true }
              : turn,
          ),
        );
      } catch (cause: unknown) {
        const text = kernelReason(cause);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? { id: turn.id, from: 'assistant', kind: 'refused', text }
              : turn,
          ),
        );
      }
    },
    [kernel, memory, patchTurns],
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
    (id: string, plan: AiPlan) => {
      try {
        const document = previewAiPlan({ kernel, plan, validationPorts: preflightPorts() });
        setPreview({ id, plan, document });
      } catch (cause: unknown) {
        const text = kernelReason(cause);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? { id: turn.id, from: 'assistant', kind: 'refused', text }
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
    },
    [patchTurns],
  );

  return (
    <section className="pg-chat" aria-label="Assistant">
      <header className="pg-chat__head">
        <div className="pg-chat__title">
          <div className="pg-chat__brand">
            <span className="pg-chat__brand-mark" aria-hidden="true">
              <IconSparkle />
            </span>
            <h2>Assistant</h2>
          </div>
          <ChromeButton variant="quiet" size="sm" onClick={startNewChat}>
            <IconPlus />
            New chat
          </ChromeButton>
        </div>
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
          <div className="pg-chat__empty">
            <span className="pg-chat__empty-mark" aria-hidden="true">
              <IconSparkle />
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

        {turns.map((turn) =>
          turn.from === 'you' ? (
            <p key={turn.id} className="pg-chat__you">
              {turn.text}
            </p>
          ) : (
            <div key={turn.id} className="pg-chat__reply">
              <span className="pg-chat__avatar" aria-hidden="true">
                <IconSparkle />
              </span>
              <div className="pg-chat__reply-body">
                {turn.kind === 'thinking' ? (
                  <div className="pg-chat__thinking">
                    <span className="pg-chat__thinking-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <p>{turn.progress ?? `Reading ${turn.subject}…`}</p>
                  </div>
                ) : null}
                {turn.kind === 'stopped' ? (
                  <div className="pg-chat__card pg-chat__card--discarded">
                    <p className="pg-chat__refused">Stopped.</p>
                  </div>
                ) : null}
                {turn.kind === 'refused' ? (
                  <div className="pg-chat__card pg-chat__card--refused">
                    <IconAlert />
                    <p className="pg-chat__refused">{turn.text}</p>
                  </div>
                ) : null}
                {turn.kind === 'discarded' ? (
                  <div className="pg-chat__card pg-chat__card--discarded">
                    <p className="pg-chat__refused">Discarded.</p>
                  </div>
                ) : null}
                {turn.kind === 'plan' ? (
                  <div
                    className={`pg-chat__card ${
                      turn.applied ? 'pg-chat__card--applied' : 'pg-chat__card--pending'
                    }`}
                  >
                    <p className="pg-chat__rationale">{turn.plan.rationale}</p>
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
                        {(turn.mode ?? 'ask') === 'plan' ? null : (
                          <ChromeButton
                            variant="primary"
                            onClick={() => {
                              accept(turn.id, turn.plan);
                            }}
                          >
                            <IconCheck />
                            Apply
                          </ChromeButton>
                        )}
                        <ChromeButton
                          variant="quiet"
                          size="sm"
                          onClick={() => {
                            openPreview(turn.id, turn.plan);
                          }}
                        >
                          <IconEye />
                          Preview
                        </ChromeButton>
                        {onReviewAsCode === undefined ? null : (
                          <ChromeButton variant="quiet" size="sm" onClick={onReviewAsCode}>
                            <IconCode />
                            Review as code
                          </ChromeButton>
                        )}
                        <ChromeButton
                          variant="quiet"
                          size="sm"
                          onClick={() => {
                            discard(turn.id);
                          }}
                        >
                          <IconClose />
                          Discard
                        </ChromeButton>
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
                        <span className="pg-chat__continue-text">{turn.plan.followUp}</span>
                      </ChromeButton>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ),
        )}
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
            disabled={busy}
            /* The field and its send button are ONE control, so the ring is
               drawn around the card by :focus-within. See the stylesheet. */
            data-bldr-focus-ring="delegated"
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
                    <span className="pg-chat__mention-excerpt">{candidate.excerpt}</span>
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
                  title={candidate.hint}
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
        {/* The whole guarantee, in one line, where the decision is made. */}
        <p className="pg-chat__guarantee">
          <IconShield />
          Whatever you apply is one entry in history, one undo.
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
                  accept(preview.id, preview.plan);
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
