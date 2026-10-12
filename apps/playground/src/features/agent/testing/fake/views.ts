/**
 * The fake views' builders: spine rows, the build / edit / plan / proposal / error records,
 * the run bar, suggestions, sessions, mention candidates, the clarify card, and the resting
 * state every scenario starts from.
 */
import type {
  AgentViewState,
  AnnouncementView,
  BuildRecordView,
  ClarifyView,
  ContextChipView,
  EditRecordView,
  ErrorView,
  FaceView,
  Locale,
  MentionCandidateView,
  ModelSelectionView,
  PlanView,
  ProposalView,
  RowState,
  RunBarView,
  SessionSummary,
  SpineRowView,
  SuggestionView,
  TurnView,
} from '../../model/view-types';

import { FAKE_NOW } from './scenarios';
import type { Words } from './words';

/* ── Builders ─────────────────────────────────────────────────────────────────── */

export const USER_TURN = 'turn-1';
export const RECORD_TURN = 'turn-2';
const MODELS: ModelSelectionView = {
  selected: { id: 'openrouter/minimax/minimax-m2:free', tier: 'free', product: 'MiniMax M2' },
  options: [
    { id: 'openrouter/minimax/minimax-m2:free', tier: 'free', product: 'MiniMax M2' },
    { id: 'cli:haiku', tier: 'fast', product: 'Claude Haiku' },
    { id: 'cli:sonnet', tier: 'careful', product: 'Claude Sonnet' },
  ],
};

export const PAGE_CHIP: ContextChipView = { kind: 'page', id: 'page' };

export function sectionId(position: number): string {
  return `section-${String(position)}`;
}

export function userTurn(
  id: string,
  text: string,
  chips: readonly ContextChipView[] = [],
): TurnView {
  return { kind: 'user', view: { turnId: id, text, chips, notRun: false } };
}

/** Spine rows from one state per section (`states[i]` is section i + 1). */
export function rows(words: Words, states: readonly RowState[], undoAfter = false): SpineRowView[] {
  return states.map((state, index) => {
    const position = index + 1;
    const landed = state === 'landed';
    return {
      key: sectionId(position),
      ...(state === 'planned' || state === 'waiting' ? {} : { nodeId: sectionId(position) }),
      position,
      total: states.length,
      title: words.sections[index] ?? `#${String(position)}`,
      state,
      ...(state === 'failed' ? { reason: 'timeout' as const } : {}),
      ...(undoAfter && landed
        ? { undo: { kind: 'undo' as const, transactionId: `tx-${String(position)}` } }
        : {}),
      ...(undoAfter && state === 'undone'
        ? { undo: { kind: 'redo' as const, transactionId: `tx-revert-${String(position)}` } }
        : {}),
      canRetry: state === 'failed' && undoAfter,
    };
  });
}

export const NO_ACTIONS: BuildRecordView['actions'] = {
  undoBuild: false,
  redoBuild: false,
  finishRest: 0,
  removeEmpty: 0,
  retryFailed: 0,
};

export function buildView(words: Words, patch: Partial<BuildRecordView>): BuildRecordView {
  const spine = patch.rows ?? [];
  return {
    turnId: RECORD_TURN,
    phase: 'building',
    landed: spine.filter((row) => row.state === 'landed').length,
    total: spine.length,
    remainingMs: null,
    direction: words.direction,
    rows: spine,
    facts: [],
    collapsed: false,
    revived: false,
    actions: NO_ACTIONS,
    menu: [],
    ...patch,
  };
}

export function editView(patch: Partial<EditRecordView>): EditRecordView {
  return {
    turnId: RECORD_TURN,
    phase: 'done',
    origin: 'request',
    changes: [],
    menu: ['reuse', 'copySummary'],
    ...patch,
  };
}

export function planView(words: Words, patch: Partial<PlanView>): PlanView {
  return {
    turnId: RECORD_TURN,
    status: 'ready',
    approval: false,
    edited: false,
    editable: true,
    note: 'exact',
    subject: words.request,
    direction: { ...words.direction, fontPairId: 'reem-kufi--ibm-plex-sans-arabic' },
    sections: words.sections.map((title, index) => ({
      key: sectionId(index + 1),
      title,
    })),
    problems: [],
    ...patch,
  };
}

export function proposalView(words: Words, patch: Partial<ProposalView>): ProposalView {
  return {
    turnId: RECORD_TURN,
    status: 'ready',
    target: words.sections[6],
    changes: words.proposalChanges,
    pageUnchanged: true,
    previewing: false,
    menu: ['viewAsCode', 'reuse'],
    ...patch,
  };
}

export function errorView(patch: Partial<ErrorView>): ErrorView {
  return {
    turnId: RECORD_TURN,
    failure: 'unreachable',
    pageState: { kind: 'unchanged' },
    retryable: true,
    details: 'provider/network: The assistant server could not be reached.',
    menu: ['reuse', 'copyError'],
    ...patch,
  };
}

export function runBar(
  patch: Partial<RunBarView> & Pick<RunBarView, 'statusKey' | 'activity'>,
  now: number,
  elapsedMs: number,
): RunBarView {
  return {
    turnId: RECORD_TURN,
    params: {},
    startedAt: now - elapsedMs,
    stopping: false,
    ...patch,
  };
}

export function suggestions(words: Words, source: 'starter' | 'followUp'): SuggestionView[] {
  const texts = source === 'starter' ? words.starters : words.suggestions;
  return texts.map((text, index) => ({ key: `${source}-${String(index + 1)}`, text, source }));
}

const FACE_IDLE: FaceView = { mood: 'idle', typing: false };

/** The resting state every scenario starts from: an empty conversation on an empty page. */
export function base(locale: Locale, words: Words): AgentViewState {
  return {
    locale,
    turns: [],
    draft: '',
    chips: [PAGE_CHIP],
    mention: null,
    mode: 'auto',
    workers: 3,
    model: MODELS,
    send: 'idle-empty',
    run: null,
    queue: null,
    sessions: [{ id: 'session-1', title: '', updatedAt: null, current: true }],
    suggestions: suggestions(words, 'starter'),
    empty: { kind: 'greeting' },
    announcement: null,
    enhancement: { status: 'idle' },
    clarify: null,
    face: FACE_IDLE,
    freeCode: { enabled: false },
  };
}

/** A conversation that has run: the request, its record, and the follow-ups. */
export function conversation(
  words: Words,
  record: TurnView,
  request: string = words.request,
  chips: readonly ContextChipView[] = [],
): readonly TurnView[] {
  return [userTurn(USER_TURN, request, chips), record];
}

export function announce(
  key: AnnouncementView['key'],
  params: AnnouncementView['params'] = {},
): AnnouncementView {
  return { key, params, seq: 1 };
}

export const WRITING_STATES: readonly RowState[] = [
  'landed',
  'writing',
  'writing',
  'drafted',
  'writing',
  'writing',
  'waiting',
  'waiting',
];

export const ALL_LANDED: readonly RowState[] = WRITING_STATES.map(() => 'landed');

export function sessions(words: Words): SessionSummary[] {
  const day = 86_400_000;
  const times = [FAKE_NOW - 60_000, FAKE_NOW - day, FAKE_NOW - 3 * day, FAKE_NOW - 7 * day];
  return words.sessions.map((title, index) => ({
    id: `session-${String(index + 1)}`,
    title,
    updatedAt: times[index] ?? FAKE_NOW - 19 * day,
    current: index === 0,
  }));
}

export function candidates(words: Words): MentionCandidateView[] {
  return words.mentions.map((label, index) => ({
    id: sectionId(index + 2),
    label,
    section: { position: index + 2, total: 8 },
  }));
}

export function clarifyView(
  words: Words,
  answered: number,
  status: ClarifyView['status'],
): ClarifyView {
  return {
    request: words.clarify.request,
    understood: words.clarify.understood,
    status,
    questions: words.clarify.questions.map((question, index) => {
      const choice = question.choices[0];
      return {
        id: `q${String(index + 1)}`,
        text: question.text,
        choices: question.choices,
        ...(index < answered && choice !== undefined ? { answer: choice } : {}),
      };
    }),
  };
}
