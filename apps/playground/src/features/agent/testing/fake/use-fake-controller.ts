/**
 * `useFakeController`: the live fake for stories, whose actions move the state the way
 * the real controller would for what a story can show without an engine.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  AgentViewState,
  ContextChipView,
  EnhancementView,
  Locale,
  RowState,
  SpineRowView,
  TurnView,
} from '../../model/view-types';

import {
  controllerOf,
  type FakeCall,
  type FakeController,
  type FakeControllerOptions,
  type Handlers,
} from './controller';
import { FAKE_CAPABILITIES, type FakeScenario } from './scenarios';
import { fakeViewState } from './view-state';
import { PAGE_CHIP, buildView, candidates, editView, runBar, userTurn } from './views';
import { WORDS, type Words } from './words';

/* ── The live fake (stories) ──────────────────────────────────────────────────── */

function withTurn(
  state: AgentViewState,
  turnId: string,
  change: (turn: TurnView) => TurnView,
): AgentViewState {
  return {
    ...state,
    turns: state.turns.map((turn) => (turn.view.turnId === turnId ? change(turn) : turn)),
  };
}

function runLife(state: AgentViewState): 'idle' | 'live' {
  return state.run === null ? 'idle' : 'live';
}

function sendStateOf(
  state: AgentViewState,
  draft: string,
  queued: boolean,
): AgentViewState['send'] {
  const empty = draft.trim() === '';
  if (runLife(state) === 'idle') return empty ? 'idle-empty' : 'idle-ready';
  if (empty) return 'running-empty';
  return queued ? 'running-queued' : 'running-ready';
}

function swapRow(row: SpineRowView, state: RowState, undo: SpineRowView['undo']): SpineRowView {
  const { undo: _old, ...rest } = row;
  void _old;
  return undo === undefined ? { ...rest, state } : { ...rest, state, undo };
}

function toggleRow(turn: TurnView, key: string, to: 'undone' | 'landed'): TurnView {
  if (turn.kind !== 'build') return turn;
  const rowsNext = turn.view.rows.map((row) => {
    if (row.key !== key) return row;
    return to === 'undone'
      ? swapRow(row, 'undone', { kind: 'redo', transactionId: `tx-revert-${key}` })
      : swapRow(row, 'landed', { kind: 'undo', transactionId: `tx-redo-${key}` });
  });
  return {
    kind: 'build',
    view: {
      ...turn.view,
      rows: rowsNext,
      landed: rowsNext.filter((row) => row.state === 'landed').length,
    },
  };
}

function mentionFor(draft: string, words: Words): AgentViewState['mention'] {
  const match = /@([\p{L}\p{M}\p{N}_-]*)$/u.exec(draft);
  if (match === null) return null;
  const query = match[1] ?? '';
  return {
    query,
    candidates: candidates(words).filter((candidate) => candidate.label.includes(query)),
  };
}

/**
 * A fake controller whose actions move the state as the real one would for what a story
 * can show without an engine: typing (and the mention list), chips, the mode and model,
 * the queue and Stop, Improve and Restore (Improve lands after `enhanceDelayMs`), the
 * clarifying questions, Apply / Discard / Build, and row Undo / Redo. Every call is also
 * recorded in `calls`.
 */
export function useFakeController(
  initial: AgentViewState | FakeScenario,
  options: FakeControllerOptions & {
    readonly locale?: Locale | undefined;
    readonly enhanceDelayMs?: number | undefined;
  } = {},
): FakeController {
  const locale = options.locale ?? 'ar';
  const [state, setState] = useState<AgentViewState>(() =>
    typeof initial === 'string' ? fakeViewState(initial, locale) : initial,
  );
  // One array for the controller's life, held in state so render may hand it out.
  const [calls] = useState<FakeCall[]>(() => []);
  const original = useRef<string | null>(null);
  const words = WORDS[state.locale];
  const { onCall } = options;
  const record = useCallback(
    (call: FakeCall) => {
      calls.push(call);
      onCall?.(call);
    },
    [calls, onCall],
  );
  const delay = options.enhanceDelayMs ?? 900;

  const handlers = useMemo<Handlers>(
    () => ({
      setDraft: (text) => {
        const draft = String(text);
        setState((current) => {
          const queued = current.queue !== null && current.queue.status !== 'paused';
          const enhancement: EnhancementView =
            current.enhancement.status === 'enhanced' || current.enhancement.status === 'failed'
              ? { status: 'idle' }
              : current.enhancement;
          return {
            ...current,
            draft,
            mention: mentionFor(draft, WORDS[current.locale]),
            enhancement,
            queue: queued
              ? draft.trim() === ''
                ? null
                : { ...current.queue, text: draft }
              : current.queue,
            send: sendStateOf(current, draft, queued && draft.trim() !== ''),
          };
        });
      },
      send: () => {
        setState((current) => {
          if (current.draft.trim() === '') return current;
          if (current.run !== null) {
            return {
              ...current,
              queue: { text: current.draft, chips: current.chips, status: 'editable' },
              send: 'running-queued',
              announcement: {
                key: 'queue.queued',
                params: {},
                seq: (current.announcement?.seq ?? 0) + 1,
              },
            };
          }
          const id = `turn-${String(current.turns.length + 1)}`;
          return {
            ...current,
            turns: [...current.turns, userTurn(id, current.draft, current.chips)],
            draft: '',
            send: 'idle-empty',
            suggestions: [],
          };
        });
      },
      stop: () => {
        setState((current) =>
          current.run === null
            ? current
            : {
                ...current,
                run: { ...current.run, stopping: true, statusKey: 'stopping', params: {} },
                queue: current.queue === null ? null : { ...current.queue, status: 'paused' },
              },
        );
      },
      removeQueued: () => {
        setState((current) => ({
          ...current,
          queue: null,
          draft: '',
          send: sendStateOf(current, '', false),
        }));
      },
      continueQueued: () => {
        setState((current) => ({ ...current, queue: null }));
      },
      setMode: (mode) => {
        setState((current) => ({ ...current, mode: mode as AgentViewState['mode'] }));
      },
      setFreeCode: (enabled) => {
        setState((current) =>
          current.freeCode == null
            ? current
            : { ...current, freeCode: { enabled: enabled === true } },
        );
      },
      setWorkers: (value) => {
        if (value !== 1 && value !== 3 && value !== 6) return;
        setState((current) => (current.run === null ? { ...current, workers: value } : current));
      },
      setModel: (id) => {
        setState((current) => {
          const selected = current.model?.options.find((option) => option.id === id);
          return current.model === null || selected === undefined
            ? current
            : { ...current, model: { ...current.model, selected } };
        });
      },
      removeChip: (id) => {
        setState((current) => {
          const chips = current.chips.filter((chip) => chip.kind === 'page' || chip.id !== id);
          return { ...current, chips: chips.length === 0 ? [PAGE_CHIP] : chips };
        });
      },
      addMention: (nodeId) => {
        setState((current) => {
          const candidate = current.mention?.candidates.find((option) => option.id === nodeId);
          if (candidate === undefined) return current;
          const chip: ContextChipView = {
            kind: 'mention',
            id: candidate.id,
            label: candidate.label,
            stale: false,
          };
          return {
            ...current,
            draft: current.draft.replace(/@[\p{L}\p{M}\p{N}_-]*$/u, ''),
            mention: null,
            chips: [...current.chips.filter((existing) => existing.kind !== 'page'), chip],
          };
        });
      },
      enhanceDraft: () => {
        setState((current) => {
          if (current.draft.trim() === '' || current.enhancement.status === 'unavailable') {
            return current;
          }
          original.current = current.draft;
          return { ...current, enhancement: { status: 'enhancing' } };
        });
        setTimeout(() => {
          setState((current) =>
            current.enhancement.status !== 'enhancing'
              ? current
              : {
                  ...current,
                  draft: WORDS[current.locale].enhanced,
                  enhancement: {
                    status: 'enhanced',
                    understood: WORDS[current.locale].understood,
                    changes: WORDS[current.locale].enhanceChanges,
                    canRestore: true,
                  },
                },
          );
        }, delay);
      },
      restoreDraft: () => {
        setState((current) => {
          const back = original.current;
          if (back === null) return current;
          original.current = null;
          return { ...current, draft: back, enhancement: { status: 'idle' } };
        });
      },
      answerClarify: (questionId, answer) => {
        setState((current) => {
          if (current.clarify === null) return current;
          const questions = current.clarify.questions.map((question) =>
            question.id === questionId ? { ...question, answer: String(answer) } : question,
          );
          const done = questions.every((question) => question.answer !== undefined);
          return {
            ...current,
            clarify: { ...current.clarify, questions, status: done ? 'rewriting' : 'asking' },
          };
        });
      },
      dismissClarify: () => {
        setState((current) =>
          current.clarify === null
            ? current
            : { ...current, draft: current.clarify.request, clarify: null, send: 'idle-ready' },
        );
      },
      sendAsWritten: () => {
        setState((current) =>
          current.clarify === null
            ? current
            : {
                ...current,
                clarify: null,
                turns: [
                  ...current.turns,
                  userTurn(`turn-${String(current.turns.length + 1)}`, current.clarify.request),
                ],
              },
        );
      },
      apply: (turnId) => {
        setState((current) =>
          withTurn(current, String(turnId), (turn) =>
            turn.kind === 'proposal'
              ? {
                  kind: 'edit',
                  view: editView({
                    turnId: turn.view.turnId,
                    origin: 'proposal',
                    target: turn.view.target,
                    changes: turn.view.changes,
                    elapsedMs: 18_000,
                    undo: { kind: 'undo', transactionId: 'tx-apply' },
                  }),
                }
              : turn,
          ),
        );
      },
      discard: (turnId) => {
        setState((current) =>
          withTurn(current, String(turnId), (turn) => {
            if (turn.kind === 'proposal') {
              return { kind: 'end', view: { turnId: turn.view.turnId, key: 'proposalDiscarded' } };
            }
            if (turn.kind === 'page-plan' || turn.kind === 'step-plan') {
              return { kind: 'end', view: { turnId: turn.view.turnId, key: 'planDiscarded' } };
            }
            return turn;
          }),
        );
      },
      build: (turnId) => {
        setState((current) => ({
          ...withTurn(current, String(turnId), (turn) => {
            if (turn.kind !== 'page-plan') return turn;
            return {
              kind: 'build',
              view: buildView(WORDS[current.locale], {
                turnId: turn.view.turnId,
                phase: 'building',
                rows: turn.view.sections.map((section, index, all) => ({
                  key: section.key,
                  position: index + 1,
                  total: all.length,
                  title: section.title,
                  state: index < 5 ? 'writing' : 'waiting',
                  canRetry: false,
                })),
              }),
            };
          }),
          run: runBar(
            {
              turnId: String(turnId),
              activity: 'build',
              statusKey: 'build.writing',
              params: { n: 5 },
            },
            Date.now(),
            0,
          ),
          send: 'running-empty',
        }));
      },
      undoSection: (turnId, key) => {
        setState((current) =>
          withTurn(current, String(turnId), (turn) => toggleRow(turn, String(key), 'undone')),
        );
      },
      redoSection: (turnId, key) => {
        setState((current) =>
          withTurn(current, String(turnId), (turn) => toggleRow(turn, String(key), 'landed')),
        );
      },
    }),
    [delay],
  );

  const capabilities = useMemo(
    () => ({ ...FAKE_CAPABILITIES, ...options.capabilities }),
    [options.capabilities],
  );
  void words;
  return useMemo(
    () => controllerOf(state, capabilities, record, calls, handlers),
    [state, capabilities, record, calls, handlers],
  );
}
