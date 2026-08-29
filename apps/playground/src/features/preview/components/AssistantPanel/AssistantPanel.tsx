import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import {
  applyAiPlan,
  createLocalAiPlanProvider,
  generateAiPlan,
  systemClock,
  systemIds,
  type AiPlan,
  type AiPlanProvider,
  type BuilderKernel,
} from '@craftkit/builder';

export interface AssistantPanelProps {
  kernel: BuilderKernel;
  /** Opens the code view on the proposal. Absent ⇒ the action is not offered. */
  onReviewAsCode?: (() => void) | undefined;
  /** Optional proposal source for an embedded or deterministic host. */
  planProvider?: AiPlanProvider | undefined;
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
    };

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
export function AssistantPanel({ kernel, onReviewAsCode, planProvider }: AssistantPanelProps) {
  const counter = useRef(1);
  const nextId = useCallback((prefix: string) => {
    counter.current += 1;
    return `${prefix}-${String(counter.current)}`;
  }, []);

  const [sessions, setSessions] = useState<readonly Session[]>(() => [
    { id: 'session-1', title: 'New chat', turns: [] },
  ]);
  const [activeId, setActiveId] = useState('session-1');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();
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

      try {
        const plan = await generateAiPlan({
          kernel,
          provider: planProvider ?? createLocalAiPlanProvider(),
          request: trimmed,
          validationPorts: preflightPorts(),
          selection: kernel.context.store.getState().selection,
        });
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === thinkingId
              ? { id: turn.id, from: 'assistant', kind: 'plan', plan, applied: false }
              : turn,
          ),
        );
      } catch (cause: unknown) {
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
      } finally {
        setBusy(false);
      }
    },
    [activeId, busy, kernel, nextId, patchTurns, planProvider, selectedType],
  );

  const accept = useCallback(
    (id: string, plan: AiPlan) => {
      try {
        applyAiPlan({ kernel, plan, validationPorts: preflightPorts() });
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
    [kernel, patchTurns],
  );

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
          <h2>Assistant</h2>
          <button type="button" className="pg-chat__new" onClick={startNewChat}>
            New chat
          </button>
        </div>
        <p className="pg-chat__sees">Sees: {sees}</p>
        {sessions.length > 1 ? (
          <label className="pg-chat__sessions">
            <span className="bldr-visually-hidden">Conversation</span>
            <select
              value={activeId}
              onChange={(event) => {
                setActiveId(event.currentTarget.value);
              }}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <div className="pg-chat__thread" ref={threadRef} role="log" aria-label="Conversation">
        {turns.length === 0 ? (
          <div className="pg-chat__empty">
            <p>Ask for a section and I will propose the exact changes.</p>
            <ul className="pg-chat__starters">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => {
                      void ask(starter);
                    }}
                  >
                    {starter}
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
              {turn.kind === 'thinking' ? (
                <p className="pg-chat__thinking">Reading {turn.subject}…</p>
              ) : null}
              {turn.kind === 'refused' ? <p className="pg-chat__refused">{turn.text}</p> : null}
              {turn.kind === 'discarded' ? <p className="pg-chat__refused">Discarded.</p> : null}
              {turn.kind === 'plan' ? (
                <>
                  <p className="pg-chat__rationale">{turn.plan.rationale}</p>
                  <ol className="pg-chat__steps">
                    {turn.plan.commands.map((step, index) => (
                      <li key={`${turn.id}-${String(index)}`}>{step.command}</li>
                    ))}
                  </ol>
                  {turn.applied ? (
                    <p className="pg-chat__applied">
                      Applied as one change.{' '}
                      <button
                        type="button"
                        className="pg-chat__undo"
                        onClick={() => {
                          kernel.undo();
                        }}
                      >
                        Undo
                      </button>
                    </p>
                  ) : (
                    <div className="pg-chat__decide">
                      <button
                        type="button"
                        className="pg-chat__accept"
                        onClick={() => {
                          accept(turn.id, turn.plan);
                        }}
                      >
                        Apply
                      </button>
                      {onReviewAsCode === undefined ? null : (
                        <button type="button" onClick={onReviewAsCode}>
                          Review as code
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          discard(turn.id);
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </>
              ) : null}
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
        <label className="bldr-visually-hidden" htmlFor={inputId}>
          Ask the assistant
        </label>
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          placeholder="Ask for a change…"
          disabled={busy}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter writes a line — the convention every
            // chat uses, and the one a person's hands already know.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void ask(draft);
            }
          }}
        />
        <button
          type="submit"
          className="pg-chat__send"
          disabled={busy || draft.trim().length === 0}
        >
          Send
        </button>
        {/* The whole guarantee, in one line, where the decision is made. */}
        <p className="pg-chat__guarantee">Whatever you apply is one entry in history, one undo.</p>
      </form>
    </section>
  );
}
