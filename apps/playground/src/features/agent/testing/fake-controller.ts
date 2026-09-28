/**
 * A deterministic AgentController for stories and component tests (SPEC §7.2, WP-11/16):
 * every §3 frame as an `AgentViewState`, in both locales, with no engine, no kernel and no
 * clock of its own.
 *
 * Three doors, from static to live:
 * - `fakeViewState(scenario, locale)`: the view of one SPEC §3 state (and the Improve and
 *   clarify states the owner asked for), built from the SPEC's own example page (the
 *   dental clinic of §3.4). Pure: the same scenario is the same object shape every time.
 * - `createFakeController(state)`: that view behind every AgentController action. Each
 *   call is recorded in `calls` (action name and arguments) and changes nothing, so a
 *   component test asserts "Retry called `retrySections(turn, [key])`" without a spy
 *   library, and a story renders exactly the state it names.
 * - `useFakeController(scenario)`: the same, as a React hook whose actions move the state
 *   the way the real controller would for the parts a story can show on its own: typing,
 *   chips, mentions, the mode and model menus, the queue, Improve and Restore, the
 *   clarifying questions, Apply / Discard, Build, row Undo / Redo, Stop.
 *
 * Nothing here imports the engine or vitest: stories load it in the browser.
 *
 * Times: every live `RunBarView.startedAt` is `now - elapsed`, with `now` from the options
 * (default `FAKE_NOW`, a fixed instant, so tests are deterministic). A story that shows a
 * ticking RunClock passes `{ now: Date.now() }`.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  AgentCapabilities,
  AgentController,
  AgentViewState,
  AnnouncementView,
  BuildRecordView,
  ChangeLineView,
  ClarifyView,
  ContextChipView,
  DirectionView,
  EditRecordView,
  EnhancementView,
  ErrorView,
  FaceView,
  Locale,
  MentionCandidateView,
  ModelSelectionView,
  PlanView,
  ProposalView,
  QueueView,
  RowState,
  RunBarView,
  SessionSummary,
  SpineRowView,
  StepPlanView,
  SuggestionView,
  TurnView,
} from '../model/view-types';

/* ── The scenarios ────────────────────────────────────────────────────────────── */

/** Every state a fake view can show, grouped by the SPEC §3 frame it draws. */
export const FAKE_SCENARIOS = [
  // §3.1 empty
  'empty',
  'emptyHasContent',
  'emptySelection',
  // §3.2 composing
  'composing',
  'mention',
  // §3.3 to §3.5 page build
  'skeleton',
  'building',
  'blocked',
  'built',
  'builtPartial',
  'builtCollapsed',
  // §3.10 stopping and stopped, and the other build endings (§4.8)
  'stopping',
  'stopped',
  'stoppedBudget',
  'stoppedMaxTasks',
  'interrupted',
  'buildFailed',
  'buildUndone',
  'buildRevived',
  // §3.6 edits
  'editRunning',
  'editDone',
  'editNoChange',
  'editUndone',
  'editStopped',
  // §4.10, §4.12 words-only answers and change plans
  'answer',
  'stepPlan',
  // §3.7 the page plan
  'planDrafting',
  'planReady',
  'planEdited',
  'planInvalid',
  'planApproval',
  'planReadOnly',
  // §3.8 Ask proposals
  'proposalDrafting',
  'proposal',
  'proposalPartial',
  'proposalPreviewing',
  'proposalApplied',
  'proposalDiscarded',
  // §3.9 the queue
  'queueTyping',
  'queued',
  'queueStale',
  'queueMissing',
  'queuePaused',
  // §3.11 errors
  'error',
  'errorKept',
  'errorSkeleton',
  // §3.12, §3.13
  'long',
  'conversations',
  // Improve and clarify (owner request, view-types EnhancementView / ClarifyView)
  'enhanceUnavailable',
  'enhancing',
  'enhanced',
  'enhanceFailed',
  'clarifyAsking',
  'clarifyPartly',
  'clarifyRewriting',
] as const;

export type FakeScenario = (typeof FAKE_SCENARIOS)[number];

/** 2026-09-28 09:00 UTC: a fixed "now" so a fake view is the same in every test run. */
export const FAKE_NOW = Date.UTC(2026, 8, 28, 9, 0, 0);

/**
 * The capabilities a fake controller reports by default: the engine as it stands on
 * 2026-09-28 (SPEC §7.6), without E3 (`undoBuild`, `restore`) or the canvas stage (E8). A
 * story of a fallback overrides one flag.
 */
export const FAKE_CAPABILITIES: AgentCapabilities = {
  rowUndo: true,
  undoBuild: false,
  restore: false,
  facts: true,
  failureClasses: true,
  editablePlan: true,
  structuredDirection: true,
  estimate: true,
  canvasStage: false,
};

export interface FakeViewOptions {
  /** Epoch ms a live run is measured to (default `FAKE_NOW`). */
  readonly now?: number | undefined;
}

/* ── The SPEC's example page, in both locales ─────────────────────────────────── */

interface Words {
  readonly sections: readonly string[];
  readonly request: string;
  readonly direction: DirectionView;
  readonly editRequest: string;
  readonly editChanges: readonly ChangeLineView[];
  readonly proposalRequest: string;
  readonly proposalChanges: readonly ChangeLineView[];
  readonly question: string;
  readonly answer: string;
  readonly steps: readonly string[];
  readonly queued: string;
  readonly facts: readonly { readonly sample: string; readonly section: number }[];
  readonly sessions: readonly string[];
  readonly understood: string;
  readonly enhanced: string;
  readonly enhanceChanges: readonly string[];
  readonly clarify: {
    readonly request: string;
    readonly understood: string;
    readonly questions: readonly {
      readonly text: string;
      readonly choices: readonly string[];
    }[];
  };
  readonly suggestions: readonly string[];
  readonly starters: readonly string[];
  readonly mentions: readonly string[];
}

const SWATCHES: DirectionView['swatches'] = [
  { role: 'background', hex: '#fbfbfd' },
  { role: 'surface', hex: '#ffffff' },
  { role: 'text', hex: '#0e1116' },
  { role: 'accent', hex: '#0f766e' },
  { role: 'onAccent', hex: '#ffffff' },
];

const WORDS: Readonly<Record<Locale, Words>> = {
  en: {
    sections: [
      'Header',
      'Hero',
      'Services',
      'Why us',
      'Doctors',
      'Testimonials',
      'FAQ',
      'Contact',
    ],
    request: 'A dental clinic page in Amman, WhatsApp booking',
    direction: {
      mood: 'Calm, clinical, teal',
      fonts: 'Reem Kufi / IBM Plex Sans Arabic',
      swatches: SWATCHES,
    },
    editRequest: 'Make the hero dark and add a WhatsApp button',
    editChanges: [
      { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
      { kind: 'added', label: 'Button', value: 'WhatsApp' },
    ],
    proposalRequest: 'Rename the FAQ heading to “Questions patients ask”',
    proposalChanges: [
      { kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' },
    ],
    question: 'How do I change the font on this page?',
    answer:
      'Open Theme in the editor and pick a display face for headings. The body face sits right under it.',
    steps: [
      'Give the hero a deep navy background.',
      'Add a WhatsApp button beside “Book now”.',
      'Keep the heading and the photo as they are.',
    ],
    queued: 'Make the header sticky',
    facts: [
      { sample: '25 JD', section: 2 },
      { sample: 'Dr. Lina Haddad', section: 4 },
      { sample: 'Rated 4.9 by 212', section: 5 },
    ],
    sessions: [
      'Dental clinic, Amman',
      'Coffee roaster page',
      'CV for Lina',
      'Launch page, Rafeeq',
      'FAQ tweaks',
    ],
    understood: 'A page for a dental clinic in Amman, with booking on WhatsApp',
    enhanced:
      'Build a one-page site for a dental clinic in Amman: services, the doctors, patient reviews and WhatsApp booking.',
    enhanceChanges: ['Named what the page must show', 'Kept your city and booking channel'],
    clarify: {
      request: 'link this page inside it',
      understood: 'You want this page reachable from another page',
      questions: [
        { text: 'Which page should link here?', choices: ['Home', 'Services', 'Contact'] },
        {
          text: 'Where should the link sit?',
          choices: ['In the header', 'In the footer', 'As a button'],
        },
      ],
    },
    suggestions: ['Add a pricing section', 'Make the colours warmer', 'Add an English version'],
    starters: [
      'A dental clinic in Amman with WhatsApp booking',
      'A specialty café: menu, hours and map',
      'A small perfume shop on Instagram',
      'A yoga studio: classes and prices',
    ],
    mentions: ['Hero', 'Services', 'Social proof'],
  },
  ar: {
    sections: [
      'الترويسة',
      'الواجهة',
      'الخدمات',
      'لماذا نحن',
      'الأطباء',
      'آراء المرضى',
      'الأسئلة الشائعة',
      'التواصل',
    ],
    request: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
    direction: {
      mood: 'هادئ، طبّي، فيروزي',
      fonts: 'Reem Kufi / IBM Plex Sans Arabic',
      swatches: SWATCHES,
    },
    editRequest: 'خلّي الواجهة داكنة وزيد زر واتساب',
    editChanges: [
      { kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'كحلي داكن' },
      { kind: 'added', label: 'زر', value: 'واتساب' },
    ],
    proposalRequest: 'غيّر عنوان الأسئلة الشائعة إلى «أسئلة يطرحها المرضى»',
    proposalChanges: [
      {
        kind: 'changed',
        label: 'العنوان',
        before: 'الأسئلة الشائعة',
        after: 'أسئلة يطرحها المرضى',
      },
    ],
    question: 'كيف أغيّر الخط في هذه الصفحة؟',
    answer:
      'يُغيَّر الخط من لوحة «السمة» في المحرّر باختيار خط العناوين، وخط النص تحته مباشرة.',
    steps: [
      'جعل خلفية الواجهة كحلية داكنة.',
      'إضافة زر واتساب بجانب «احجز موعدًا».',
      'إبقاء العنوان والصورة كما هما.',
    ],
    queued: 'تثبيت الترويسة أعلى الصفحة',
    facts: [
      { sample: '25 دينارًا', section: 2 },
      { sample: 'د. لينا حداد', section: 4 },
      { sample: 'تقييم 4.9 من 212 مراجعًا', section: 5 },
    ],
    sessions: [
      'عيادة أسنان، عمّان',
      'صفحة محمصة قهوة',
      'سيرة ذاتية للينا',
      'صفحة إطلاق رفيق',
      'تعديلات الأسئلة الشائعة',
    ],
    understood: 'صفحة لعيادة أسنان في عمّان مع الحجز عبر واتساب',
    enhanced:
      'بناء صفحة واحدة لعيادة أسنان في عمّان تعرض الخدمات والأطباء وآراء المرضى، مع الحجز عبر واتساب.',
    enhanceChanges: ['تحديد ما يجب أن تعرضه الصفحة', 'إبقاء المدينة ووسيلة الحجز كما هما'],
    clarify: {
      request: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
      understood: 'الوصول إلى هذه الصفحة من صفحة أخرى',
      questions: [
        { text: 'أي صفحة يُضاف فيها الرابط؟', choices: ['الرئيسية', 'الخدمات', 'التواصل'] },
        { text: 'أين يوضع الرابط؟', choices: ['في الترويسة', 'في التذييل', 'كزر'] },
      ],
    },
    suggestions: ['إضافة قسم للأسعار', 'ألوان أدفأ للصفحة', 'إضافة نسخة إنجليزية'],
    starters: [
      'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
      'مقهى مختص في إربد: القائمة والدوام والموقع',
      'متجر عطور صغير يبيع عبر إنستغرام',
      'مكتب محاماة في رام الله: الخدمات والفريق',
    ],
    mentions: ['الواجهة', 'الخدمات', 'آراء المرضى'],
  },
};

/* ── Builders ─────────────────────────────────────────────────────────────────── */

const USER_TURN = 'turn-1';
const RECORD_TURN = 'turn-2';
const MODELS: ModelSelectionView = {
  selected: { id: 'openrouter/minimax/minimax-m2:free', tier: 'free', product: 'MiniMax M2' },
  options: [
    { id: 'openrouter/minimax/minimax-m2:free', tier: 'free', product: 'MiniMax M2' },
    { id: 'cli:haiku', tier: 'fast', product: 'Claude Haiku' },
    { id: 'cli:sonnet', tier: 'careful', product: 'Claude Sonnet' },
  ],
};

const PAGE_CHIP: ContextChipView = { kind: 'page', id: 'page' };

function sectionId(position: number): string {
  return `section-${String(position)}`;
}

function userTurn(id: string, text: string, chips: readonly ContextChipView[] = []): TurnView {
  return { kind: 'user', view: { turnId: id, text, chips, notRun: false } };
}

/** Spine rows from one state per section (`states[i]` is section i + 1). */
function rows(words: Words, states: readonly RowState[], undoAfter = false): SpineRowView[] {
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

const NO_ACTIONS: BuildRecordView['actions'] = {
  undoBuild: false,
  redoBuild: false,
  finishRest: 0,
  removeEmpty: 0,
  retryFailed: 0,
};

function buildView(words: Words, patch: Partial<BuildRecordView>): BuildRecordView {
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

function editView(patch: Partial<EditRecordView>): EditRecordView {
  return {
    turnId: RECORD_TURN,
    phase: 'done',
    origin: 'request',
    changes: [],
    menu: ['reuse', 'copySummary'],
    ...patch,
  };
}

function planView(words: Words, patch: Partial<PlanView>): PlanView {
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

function proposalView(words: Words, patch: Partial<ProposalView>): ProposalView {
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

function errorView(patch: Partial<ErrorView>): ErrorView {
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

function runBar(
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

function suggestions(words: Words, source: 'starter' | 'followUp'): SuggestionView[] {
  const texts = source === 'starter' ? words.starters : words.suggestions;
  return texts.map((text, index) => ({ key: `${source}-${String(index + 1)}`, text, source }));
}

const FACE_IDLE: FaceView = { mood: 'idle', typing: false };

/** The resting state every scenario starts from: an empty conversation on an empty page. */
function base(locale: Locale, words: Words): AgentViewState {
  return {
    locale,
    turns: [],
    draft: '',
    chips: [PAGE_CHIP],
    mention: null,
    mode: 'auto',
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
  };
}

/** A conversation that has run: the request, its record, and the follow-ups. */
function conversation(
  words: Words,
  record: TurnView,
  request: string = words.request,
  chips: readonly ContextChipView[] = [],
): readonly TurnView[] {
  return [userTurn(USER_TURN, request, chips), record];
}

function announce(key: AnnouncementView['key'], params: AnnouncementView['params'] = {}): AnnouncementView {
  return { key, params, seq: 1 };
}

const WRITING_STATES: readonly RowState[] = [
  'landed',
  'writing',
  'writing',
  'drafted',
  'writing',
  'writing',
  'waiting',
  'waiting',
];

const ALL_LANDED: readonly RowState[] = WRITING_STATES.map(() => 'landed');

function sessions(words: Words): SessionSummary[] {
  const day = 86_400_000;
  const times = [FAKE_NOW - 60_000, FAKE_NOW - day, FAKE_NOW - 3 * day, FAKE_NOW - 7 * day];
  return words.sessions.map((title, index) => ({
    id: `session-${String(index + 1)}`,
    title,
    updatedAt: times[index] ?? FAKE_NOW - 19 * day,
    current: index === 0,
  }));
}

function candidates(words: Words): MentionCandidateView[] {
  return words.mentions.map((label, index) => ({
    id: sectionId(index + 2),
    label,
    section: { position: index + 2, total: 8 },
  }));
}

function clarifyView(words: Words, answered: number, status: ClarifyView['status']): ClarifyView {
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

/**
 * The view of one scenario. Titles, requests and answers are in `locale`, so an Arabic
 * story shows the SPEC §3.15 copy and an English one the §3.4 copy.
 */
export function fakeViewState(
  scenario: FakeScenario,
  locale: Locale = 'ar',
  options: FakeViewOptions = {},
): AgentViewState {
  const now = options.now ?? FAKE_NOW;
  const words = WORDS[locale];
  const start = base(locale, words);
  const hasContent: Partial<AgentViewState> = {
    empty: { kind: 'hasContent', sections: 8 },
    suggestions: [],
  };
  const heroChip: ContextChipView = {
    kind: 'selection',
    id: sectionId(2),
    label: words.sections[1] ?? '',
    stale: false,
  };
  const running = (
    record: TurnView,
    bar: RunBarView,
    request: string = words.request,
  ): AgentViewState => ({
    ...start,
    ...hasContent,
    turns: conversation(words, record, request),
    run: bar,
    send: 'running-empty',
    face: { mood: 'working', typing: false },
  });
  const settled = (record: TurnView, extra: Partial<AgentViewState> = {}): AgentViewState => ({
    ...start,
    ...hasContent,
    turns: conversation(words, record),
    suggestions: suggestions(words, 'followUp').slice(0, 3),
    ...extra,
  });
  const built = (): TurnView => ({
    kind: 'build',
    view: buildView(words, {
      phase: 'done',
      rows: rows(words, ALL_LANDED, true),
      elapsedMs: 141_000,
      facts: words.facts.map((fact) => ({
        sample: fact.sample,
        section: words.sections[fact.section] ?? '',
        nodeId: sectionId(fact.section + 1),
      })),
      actions: { ...NO_ACTIONS, undoBuild: true },
      menu: ['reuse', 'copySummary'],
    }),
  });
  const buildingRecord = (states: readonly RowState[] = WRITING_STATES): TurnView => ({
    kind: 'build',
    view: buildView(words, { phase: 'building', rows: rows(words, states), remainingMs: 90_000 }),
  });

  switch (scenario) {
    case 'empty':
      return start;
    case 'emptyHasContent':
      return { ...start, empty: { kind: 'hasContent', sections: 8 }, suggestions: suggestions(words, 'followUp') };
    case 'emptySelection':
      return {
        ...start,
        empty: { kind: 'selection', title: words.sections[1] ?? '' },
        chips: [heroChip],
        suggestions: suggestions(words, 'followUp').slice(0, 3),
      };
    case 'composing':
      return {
        ...start,
        ...hasContent,
        draft: words.editRequest,
        chips: [heroChip],
        send: 'idle-ready',
        suggestions: [],
        face: { mood: 'listening', typing: true },
      };
    case 'mention':
      return {
        ...start,
        ...hasContent,
        draft: `${words.editRequest} @`,
        chips: [heroChip],
        mention: { query: '', candidates: candidates(words) },
        send: 'idle-ready',
        suggestions: [],
        face: { mood: 'listening', typing: true },
      };
    case 'skeleton':
      return {
        ...running(
          { kind: 'build', view: buildView(words, { phase: 'skeleton', rows: [], direction: undefined }) },
          runBar({ activity: 'build', statusKey: 'build.started' }, now, 4_000),
        ),
        empty: { kind: 'greeting' },
        face: { mood: 'planning', typing: false },
        announcement: announce('build.started'),
      };
    case 'building':
      return running(
        buildingRecord(),
        runBar({ activity: 'build', statusKey: 'build.writing', params: { n: 4 } }, now, 72_000),
      );
    case 'blocked':
      return running(
        buildingRecord(['landed', 'writing', 'drafted', 'drafted', 'drafted', 'waiting', 'waiting', 'waiting']),
        runBar(
          { activity: 'build', statusKey: 'build.blocked', params: { title: words.sections[1] ?? '' } },
          now,
          95_000,
        ),
      );
    case 'built':
      return settled(built(), {
        face: { mood: 'done', outcome: 'applied', typing: false },
        announcement: announce('build.done', { n: 8 }),
      });
    case 'builtPartial': {
      const states: RowState[] = [...ALL_LANDED];
      states[4] = 'failed';
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'partial',
          rows: rows(words, states, true),
          elapsedMs: 160_000,
          actions: { ...NO_ACTIONS, undoBuild: true, retryFailed: 1 },
          menu: ['reuse', 'copySummary'],
        }),
      });
    }
    case 'builtCollapsed': {
      const record = built();
      const collapsed: TurnView =
        record.kind === 'build' ? { kind: 'build', view: { ...record.view, collapsed: true } } : record;
      return {
        ...start,
        ...hasContent,
        turns: [
          userTurn(USER_TURN, words.request),
          collapsed,
          userTurn('turn-3', words.editRequest, [heroChip]),
          {
            kind: 'edit',
            view: editView({
              turnId: 'turn-4',
              target: words.sections[1],
              changes: words.editChanges,
              elapsedMs: 16_000,
              revealNodeId: sectionId(2),
              undo: { kind: 'undo', transactionId: 'tx-edit' },
            }),
          },
        ],
        suggestions: suggestions(words, 'followUp').slice(0, 3),
      };
    }
    case 'stopping':
      return {
        ...running(
          { kind: 'build', view: buildView(words, { phase: 'stopping', rows: rows(words, WRITING_STATES) }) },
          runBar({ activity: 'build', statusKey: 'stopping', stopping: true }, now, 110_000),
        ),
        announcement: announce('stopping'),
      };
    case 'stopped':
    case 'stoppedBudget':
    case 'stoppedMaxTasks': {
      const states: RowState[] = ['landed', 'landed', 'landed', 'landed', 'landed', 'notWritten', 'notWritten', 'notWritten'];
      const stopReason =
        scenario === 'stopped' ? 'signal' : scenario === 'stoppedBudget' ? 'budget' : 'maxTasks';
      return settled(
        {
          kind: 'build',
          view: buildView(words, {
            phase: 'stopped',
            stopReason,
            rows: rows(words, states, true),
            elapsedMs: 112_000,
            actions: { ...NO_ACTIONS, finishRest: 3, removeEmpty: 3 },
            menu: ['reuse', 'copySummary'],
          }),
        },
        {
          face: { mood: 'stopped', typing: false },
          suggestions: [],
          queue: { text: words.queued, chips: [PAGE_CHIP], status: 'paused' },
        },
      );
    }
    case 'interrupted': {
      const states: RowState[] = ['landed', 'landed', 'landed', 'notWritten', 'notWritten', 'notWritten', 'notWritten', 'notWritten'];
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'interrupted',
          rows: rows(words, states).map((row) =>
            row.state === 'landed' ? { ...row, undo: { kind: 'unavailable', why: 'revived' } } : row,
          ),
          revived: true,
          actions: { ...NO_ACTIONS, finishRest: 5, removeEmpty: 5 },
          menu: ['reuse', 'copySummary'],
        }),
      });
    }
    case 'buildFailed':
      return settled(
        {
          kind: 'build',
          view: buildView(words, {
            phase: 'failed',
            rows: rows(words, WRITING_STATES.map(() => 'failed')),
            elapsedMs: 31_000,
            menu: ['reuse', 'copyError'],
            error: {
              failure: 'unreachable',
              pageState: { kind: 'skeleton' },
              retryable: true,
              details: 'provider/network: The assistant server could not be reached.',
            },
          }),
        },
        { face: { mood: 'failed', typing: false } },
      );
    case 'buildUndone':
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'undone',
          rows: rows(words, ALL_LANDED.map(() => 'undone')).map((row) => {
            const { nodeId, ...rest } = row;
            void nodeId;
            return rest;
          }),
          elapsedMs: 141_000,
          actions: { ...NO_ACTIONS, redoBuild: true },
          menu: ['reuse', 'copySummary'],
        }),
      });
    case 'buildRevived':
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'done',
          rows: rows(words, ALL_LANDED).map((row) => ({
            ...row,
            undo: { kind: 'unavailable', why: 'revived' },
          })),
          elapsedMs: 141_000,
          revived: true,
          menu: ['reuse', 'copySummary'],
        }),
      });
    case 'editRunning':
      return {
        ...running(
          {
            kind: 'edit',
            view: editView({
              phase: 'running',
              target: words.sections[1],
              stage: 'edit.checking',
              menu: [],
            }),
          },
          runBar({ activity: 'edit', statusKey: 'edit.checking' }, now, 7_000),
          words.editRequest,
        ),
        chips: [heroChip],
        face: { mood: 'planning', variant: 'checking', typing: false },
      };
    case 'editDone':
      return settled(
        {
          kind: 'edit',
          view: editView({
            target: words.sections[1],
            changes: words.editChanges,
            elapsedMs: 16_000,
            revealNodeId: sectionId(2),
            undo: { kind: 'undo', transactionId: 'tx-edit' },
          }),
        },
        { chips: [heroChip], face: { mood: 'done', outcome: 'applied', typing: false } },
      );
    case 'editNoChange':
      return settled({
        kind: 'edit',
        view: editView({ phase: 'noChange', target: words.sections[1], elapsedMs: 9_000 }),
      });
    case 'editUndone':
      return settled({
        kind: 'edit',
        view: editView({
          phase: 'undone',
          target: words.sections[1],
          changes: words.editChanges,
          elapsedMs: 16_000,
          undo: { kind: 'redo', transactionId: 'tx-edit' },
        }),
      });
    case 'editStopped':
      return settled({
        kind: 'edit',
        view: editView({ phase: 'stopped', target: words.sections[1], elapsedMs: 5_000, menu: ['reuse'] }),
      });
    case 'answer':
      return {
        ...settled({
          kind: 'answer',
          view: { turnId: RECORD_TURN, text: words.answer, menu: ['reuse', 'copyAnswer'] },
        }),
        turns: conversation(
          words,
          { kind: 'answer', view: { turnId: RECORD_TURN, text: words.answer, menu: ['reuse', 'copyAnswer'] } },
          words.question,
        ),
      };
    case 'stepPlan': {
      const view: StepPlanView = {
        turnId: RECORD_TURN,
        status: 'ready',
        steps: words.steps.map((text, index) => ({
          key: `step-${String(index + 1)}`,
          text,
          target: words.sections[1],
        })),
      };
      return {
        ...start,
        ...hasContent,
        mode: 'plan',
        turns: conversation(words, { kind: 'step-plan', view }, words.editRequest),
      };
    }
    case 'planDrafting':
      return {
        ...running(
          { kind: 'page-plan', view: planView(words, { status: 'drafting', sections: [], direction: undefined }) },
          runBar({ activity: 'plan', statusKey: 'plan.drafting' }, now, 6_000),
        ),
        mode: 'plan',
        empty: { kind: 'greeting' },
        face: { mood: 'planning', typing: false },
      };
    case 'planReady':
    case 'planEdited':
    case 'planInvalid':
    case 'planApproval':
    case 'planReadOnly': {
      const patch: Partial<PlanView> =
        scenario === 'planEdited'
          ? {
              edited: true,
              sections: planView(words, {}).sections.map((section, index) =>
                index === 5 ? { ...section, title: locale === 'ar' ? 'قصص المرضى' : 'Patient stories' } : section,
              ),
            }
          : scenario === 'planInvalid'
            ? {
                edited: true,
                problems: ['contrast'],
                direction: {
                  ...words.direction,
                  swatches: SWATCHES?.map((swatch) =>
                    swatch.role === 'text' ? { ...swatch, hex: '#d4d4d8' } : swatch,
                  ),
                },
              }
            : scenario === 'planApproval'
              ? { approval: true }
              : scenario === 'planReadOnly'
                ? { editable: false, note: 'mayDiffer', direction: { mood: words.direction.mood } }
                : {};
      return {
        ...start,
        mode: scenario === 'planApproval' ? 'ask' : 'plan',
        turns: conversation(words, { kind: 'page-plan', view: planView(words, patch) }),
        suggestions: [],
        announcement: announce('plan.ready'),
      };
    }
    case 'proposalDrafting':
      return {
        ...running(
          { kind: 'proposal', view: proposalView(words, { status: 'drafting', changes: [], menu: [] }) },
          runBar({ activity: 'proposal', statusKey: 'proposal.drafting' }, now, 5_000),
          words.proposalRequest,
        ),
        mode: 'ask',
      };
    case 'proposal':
    case 'proposalPartial':
    case 'proposalPreviewing':
      return {
        ...start,
        ...hasContent,
        mode: 'ask',
        turns: conversation(
          words,
          {
            kind: 'proposal',
            view: proposalView(
              words,
              scenario === 'proposalPartial'
                ? { partial: { kept: 2, total: 3 } }
                : scenario === 'proposalPreviewing'
                  ? { previewing: true }
                  : {},
            ),
          },
          words.proposalRequest,
        ),
        announcement: announce('proposal.ready'),
      };
    case 'proposalApplied':
      return {
        ...settled({
          kind: 'edit',
          view: editView({
            origin: 'proposal',
            target: words.sections[6],
            changes: words.proposalChanges,
            elapsedMs: 18_000,
            undo: { kind: 'undo', transactionId: 'tx-apply' },
          }),
        }),
        mode: 'ask',
      };
    case 'proposalDiscarded':
      return {
        ...settled({ kind: 'end', view: { turnId: RECORD_TURN, key: 'proposalDiscarded' } }),
        mode: 'ask',
      };
    case 'queueTyping':
    case 'queued':
    case 'queueStale':
    case 'queueMissing': {
      const states: RowState[] = ['landed', 'landed', 'landed', 'landed', 'landed', 'writing', 'drafted', 'writing'];
      const state = running(
        buildingRecord(states),
        runBar({ activity: 'build', statusKey: 'build.writing', params: { n: 2 } }, now, 100_000),
      );
      if (scenario === 'queueTyping') {
        return { ...state, draft: words.queued, send: 'running-ready' };
      }
      const status: QueueView['status'] =
        scenario === 'queueStale' ? 'stale' : scenario === 'queueMissing' ? 'missing' : 'editable';
      return {
        ...state,
        draft: words.queued,
        send: 'running-queued',
        queue: { text: words.queued, chips: [PAGE_CHIP], status },
        announcement: announce('queue.queued'),
      };
    }
    case 'queuePaused':
      return fakeViewState('stopped', locale, options);
    case 'error':
    case 'errorKept':
    case 'errorSkeleton':
      return settled(
        {
          kind: 'error',
          view: errorView(
            scenario === 'errorKept'
              ? { pageState: { kind: 'kept', landed: 3 } }
              : scenario === 'errorSkeleton'
                ? { pageState: { kind: 'skeleton' } }
                : {},
          ),
        },
        { face: { mood: 'failed', typing: false }, suggestions: [] },
      );
    case 'long': {
      const record = built();
      const collapsed: TurnView =
        record.kind === 'build' ? { kind: 'build', view: { ...record.view, collapsed: true } } : record;
      return {
        ...start,
        ...hasContent,
        turns: [
          userTurn(USER_TURN, words.request),
          collapsed,
          userTurn('turn-3', words.editRequest, [heroChip]),
          {
            kind: 'edit',
            view: editView({
              turnId: 'turn-4',
              target: words.sections[1],
              changes: words.editChanges,
              elapsedMs: 16_000,
              revealNodeId: sectionId(2),
              undo: { kind: 'undo', transactionId: 'tx-edit' },
            }),
          },
          userTurn('turn-5', locale === 'ar' ? 'أضف الأسعار وخريطة لقسم التواصل' : 'Add pricing and a map to the contact section'),
          {
            kind: 'edit',
            view: editView({ turnId: 'turn-6', phase: 'running', stage: 'edit.writing', target: words.sections[7], menu: [] }),
          },
        ],
        run: runBar({ turnId: 'turn-6', activity: 'edit', statusKey: 'edit.writing' }, now, 41_000),
        send: 'running-empty',
        face: { mood: 'working', typing: false },
      };
    }
    case 'conversations':
      return { ...settled(built()), sessions: sessions(words) };
    case 'enhanceUnavailable':
      return {
        ...start,
        draft: words.request,
        send: 'idle-ready',
        suggestions: [],
        enhancement: { status: 'unavailable' },
      };
    case 'enhancing':
      return {
        ...start,
        draft: words.request,
        send: 'idle-ready',
        suggestions: [],
        enhancement: { status: 'enhancing' },
        face: { mood: 'thinking', typing: false },
      };
    case 'enhanced':
      return {
        ...start,
        draft: words.enhanced,
        send: 'idle-ready',
        suggestions: [],
        enhancement: {
          status: 'enhanced',
          understood: words.understood,
          changes: words.enhanceChanges,
          canRestore: true,
        },
        announcement: announce('enhance.ready'),
      };
    case 'enhanceFailed':
      return {
        ...start,
        draft: words.request,
        send: 'idle-ready',
        suggestions: [],
        enhancement: { status: 'failed', reason: 'unreachable' },
      };
    case 'clarifyAsking':
    case 'clarifyPartly':
    case 'clarifyRewriting':
      return {
        ...start,
        ...hasContent,
        clarify: clarifyView(
          words,
          scenario === 'clarifyAsking' ? 0 : scenario === 'clarifyPartly' ? 1 : 2,
          scenario === 'clarifyRewriting' ? 'rewriting' : 'asking',
        ),
        announcement: scenario === 'clarifyAsking' ? announce('clarify.ready') : null,
        face:
          scenario === 'clarifyRewriting'
            ? { mood: 'thinking', typing: false }
            : { mood: 'idle', typing: false },
      };
  }
}

/* ── The static controller ────────────────────────────────────────────────────── */

/** Every AgentController action, by name. */
export type FakeAction = {
  [K in keyof AgentController]-?: NonNullable<AgentController[K]> extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof AgentController];

/** One recorded call: the action and the arguments it was given. */
export interface FakeCall {
  readonly action: FakeAction;
  readonly args: readonly unknown[];
}

/** A fake controller, with every call it received. */
export interface FakeController extends AgentController {
  readonly calls: readonly FakeCall[];
}

export interface FakeControllerOptions {
  readonly capabilities?: Partial<AgentCapabilities> | undefined;
  /** Told of every call as it happens (a story's action logger, a test's assertion). */
  readonly onCall?: ((call: FakeCall) => void) | undefined;
}

const ACTIONS: readonly FakeAction[] = [
  'send',
  'stop',
  'removeQueued',
  'continueQueued',
  'apply',
  'discard',
  'build',
  'runSteps',
  'editPlan',
  'undoSection',
  'redoSection',
  'undoBuild',
  'retrySections',
  'finishRest',
  'removeEmpty',
  'tryAgain',
  'reveal',
  'peek',
  'reuse',
  'setDraft',
  'setMode',
  'setModel',
  'newConversation',
  'openConversation',
  'deleteConversation',
  'redoBuild',
  'undoEdit',
  'redoEdit',
  'togglePreview',
  'viewAsCode',
  'copy',
  'restore',
  'showTechnicalDetails',
  'openPageHistory',
  'removeChip',
  'addMention',
  'enhanceDraft',
  'restoreDraft',
  'answerClarify',
  'sendAsWritten',
  'dismissClarify',
  'setComposerFocused',
];

type Handlers = Partial<Record<FakeAction, (...args: readonly unknown[]) => void>>;

function controllerOf(
  state: AgentViewState,
  capabilities: AgentCapabilities,
  record: (call: FakeCall) => void,
  calls: readonly FakeCall[],
  handlers: Handlers = {},
): FakeController {
  const act =
    (action: FakeAction) =>
    (...args: readonly unknown[]): void => {
      record({ action, args });
      handlers[action]?.(...args);
    };
  const entries = Object.fromEntries(ACTIONS.map((action) => [action, act(action)])) as Record<
    FakeAction,
    (...args: readonly unknown[]) => void
  >;
  return {
    ...(entries as unknown as Omit<AgentController, 'state' | 'capabilities' | 'restore'>),
    // Restore answers a promise; the fake always restores.
    restore: (turnId: string) => {
      record({ action: 'restore', args: [turnId] });
      return Promise.resolve('restored' as const);
    },
    state,
    capabilities,
    calls,
  };
}

/**
 * A controller over a fixed state: every action is recorded in `calls` and changes
 * nothing. For component tests ("Retry calls `retrySections` with the row's key") and
 * for stories of one exact frame.
 */
export function createFakeController(
  state: AgentViewState,
  options: FakeControllerOptions = {},
): FakeController {
  const calls: FakeCall[] = [];
  const capabilities = { ...FAKE_CAPABILITIES, ...options.capabilities };
  return controllerOf(
    state,
    capabilities,
    (call) => {
      calls.push(call);
      options.onCall?.(call);
    },
    calls,
  );
}

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

function sendStateOf(state: AgentViewState, draft: string, queued: boolean): AgentViewState['send'] {
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
            queue:
              queued
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
              announcement: { key: 'queue.queued', params: {}, seq: (current.announcement?.seq ?? 0) + 1 },
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
                queue:
                  current.queue === null ? null : { ...current.queue, status: 'paused' },
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
            { turnId: String(turnId), activity: 'build', statusKey: 'build.writing', params: { n: 5 } },
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
