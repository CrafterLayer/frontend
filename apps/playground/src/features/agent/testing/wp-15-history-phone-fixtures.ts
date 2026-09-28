/**
 * View fixtures for the conversations list and the phone sheet (WP-15): HistoryPopover,
 * HistoryRow, AgentSheet, SheetMiniBar and MiniSpine. Stories and tests only.
 *
 * Every value is a view as the controller hands it to the panel (`model/view-types.ts`).
 * The fixtures author only what a person or the page would have written: the requests
 * that title each conversation, and the section titles of one clinic page (SPEC §3.4,
 * §3.13, §3.16). Each locale's set is written in its own language, not translated, and
 * the Arabic requests are typed the way a Levantine owner types them.
 *
 * Time is local noon on 28 September 2026, and every other time is built from it in local
 * calendar terms, so "Yesterday", "3 days ago" and "21 Sep" read the same in any time zone
 * the suite runs in (`formatWhen` counts calendar days in local time).
 */
import type {
  AgentViewState,
  BuildActionsView,
  BuildPhase,
  BuildRecordView,
  EditRecordView,
  ErrorView,
  Locale,
  ProposalView,
  RowState,
  RunBarView,
  SessionSummary,
  SpineRowView,
  TurnView,
} from '../model/view-types';

/* ── Time ────────────────────────────────────────────────────────────────── */

/** "Now" for every fixture: local noon, 28 September 2026. */
export const FIXTURE_NOW = new Date(2026, 8, 28, 12, 0, 0).getTime();

/** Local time on a day of September 2026 (or August, with a month of 7). */
function localTime(day: number, hour: number, minute = 0, month = 8): number {
  return new Date(2026, month, day, hour, minute, 0).getTime();
}

/* ── Conversations (SPEC §3.13, §4.18) ───────────────────────────────────── */

interface ConversationSeed {
  readonly id: string;
  /** The first request, as the person typed it: the row's title. */
  readonly title: Readonly<Record<Locale, string>>;
  readonly updatedAt: number | null;
}

/*
  The §3.13 frame's five conversations first (the current one, yesterday, three days ago,
  21 Sep, 9 Sep), then the older ones a long history holds. One title per locale runs in
  the other script, so a right-to-left title in a left-to-right list (and the reverse) is
  always on screen; one has no time, as a conversation migrated from v1 storage has none.
*/
const CONVERSATIONS: readonly ConversationSeed[] = [
  {
    id: 'c-clinic',
    title: {
      en: 'A dental clinic page in Amman, with WhatsApp booking',
      ar: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
    },
    updatedAt: FIXTURE_NOW - 20_000,
  },
  {
    id: 'c-roaster',
    title: {
      en: 'Coffee roaster page with a monthly subscription',
      ar: 'صفحة لمحمصة قهوة مع اشتراك شهري',
    },
    updatedAt: localTime(27, 18, 40),
  },
  {
    id: 'c-cv',
    title: { en: 'CV for Lina, product designer', ar: 'سيرة ذاتية للينا، مصممة منتجات' },
    updatedAt: localTime(25, 9, 15),
  },
  {
    id: 'c-rafeeq',
    title: {
      en: 'Launch page for Rafeeq, the carpool app',
      ar: 'Landing page لتطبيق رفيق لمشاركة الرحلات',
    },
    updatedAt: localTime(21, 16, 5),
  },
  {
    id: 'c-faq',
    title: { en: 'Tighten the FAQ answers', ar: 'قصّر أجوبة الأسئلة الشائعة' },
    updatedAt: localTime(9, 11, 30),
  },
  {
    id: 'c-law',
    title: {
      en: 'موقع لمكتب محاماة في رام الله',
      ar: 'موقع لمكتب محاماة في رام الله: الخدمات والفريق',
    },
    updatedAt: localTime(5, 10, 0),
  },
  {
    id: 'c-wedding',
    title: {
      en: 'Portfolio for a wedding photographer',
      ar: 'معرض أعمال لمصوّر أعراس',
    },
    updatedAt: localTime(2, 20, 10),
  },
  {
    id: 'c-physio',
    title: {
      en: 'Physiotherapy clinic: treatments, team and booking',
      ar: 'عياده علاج طبيعي: العلاجات والفريق والحجز',
    },
    updatedAt: localTime(28, 14, 0, 7),
  },
  {
    id: 'c-restaurant',
    title: {
      en: 'Menu page for Beit Sitti restaurant',
      ar: 'صفحة منيو لمطعم بيت ستي',
    },
    updatedAt: localTime(19, 13, 45, 7),
  },
  {
    id: 'c-yoga',
    title: { en: 'Pricing table for the yoga studio', ar: 'جدول أسعار لاستوديو اليوغا' },
    updatedAt: localTime(11, 8, 20, 7),
  },
  {
    id: 'c-perfume',
    title: {
      en: 'A small perfume shop on Instagram',
      ar: 'متجر عطور صغير بيبيع على إنستغرام',
    },
    updatedAt: localTime(2, 17, 0, 7),
  },
  {
    id: 'c-bakery',
    title: { en: 'Rewrite the hero for the bakery', ar: 'أعد كتابة واجهة المخبز' },
    updatedAt: null,
  },
];

/**
 * The conversations HistoryPopover lists, newest first, with `c-clinic` current.
 * `count` takes the first n: 5 is the §3.13 frame, 12 crosses the search threshold (8).
 */
export function conversations(
  locale: Locale,
  count = 5,
  current: string | null = 'c-clinic',
): readonly SessionSummary[] {
  return CONVERSATIONS.slice(0, count).map((seed) => ({
    id: seed.id,
    title: seed.title[locale],
    updatedAt: seed.updatedAt,
    current: seed.id === current,
  }));
}

/**
 * What a person searching the long list types, per locale. The Arabic one is typed the
 * quick way, «عياده» with a final hāʾ, and still finds both clinics, the one spelled
 * «عيادة» included: the search folds the letters people type interchangeably.
 */
export const SEARCH_QUERY: Readonly<Record<Locale, string>> = { en: 'clinic', ar: 'عياده' };

/* ── The clinic page's spine (SPEC §3.4, §3.16) ──────────────────────────── */

const SECTIONS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['Header', 'Hero', 'Services', 'Why us', 'Doctors', 'Testimonials', 'FAQ', 'Contact'],
  ar: [
    'الترويسة',
    'الواجهة',
    'الخدمات',
    'لماذا نحن',
    'الأطباء',
    'آراء المرضى',
    'الأسئلة الشائعة',
    'التواصل',
  ],
};

/** The §3.4 moment: 1 on the page; 2, 3, 5 and 6 writing; 4 drafted; 7 and 8 waiting. */
export const PARALLEL_STATES: readonly RowState[] = [
  'landed',
  'writing',
  'writing',
  'drafted',
  'writing',
  'writing',
  'waiting',
  'waiting',
];

/** One spine row per state, titled by the clinic page's sections in page order. */
export function clinicRows(locale: Locale, states: readonly RowState[]): readonly SpineRowView[] {
  const titles = SECTIONS[locale];
  return states.map((state, index) => {
    const exists = state === 'landed' || state === 'undone' || state === 'failed';
    return {
      key: `section-${String(index + 1)}`,
      nodeId: exists ? `node-${String(index + 1)}` : undefined,
      position: index + 1,
      total: states.length,
      title: titles[index % titles.length] ?? '',
      state,
      reason: state === 'failed' ? 'timeout' : undefined,
      undo:
        state === 'landed' ? { kind: 'undo', transactionId: `tx-${String(index + 1)}` } : undefined,
      canRetry: state === 'failed',
    };
  });
}

const NO_ACTIONS: BuildActionsView = {
  undoBuild: false,
  redoBuild: false,
  finishRest: 0,
  removeEmpty: 0,
  retryFailed: 0,
};

/** A build record over `rows`; `landed` counts only the landed rows (ink means landed). */
export function buildRecord(
  phase: BuildPhase,
  rows: readonly SpineRowView[],
  overrides: Partial<BuildRecordView> = {},
): BuildRecordView {
  return {
    turnId: 'turn-build',
    phase,
    landed: rows.filter((row) => row.state === 'landed').length,
    total: rows.length,
    remainingMs: null,
    rows,
    facts: [],
    collapsed: false,
    revived: false,
    actions: NO_ACTIONS,
    menu: [],
    ...overrides,
  };
}

/* ── The mini row's moments (SPEC §3.16, §3.17, §4.19) ───────────────────── */

/** What `miniBarView` reads: the thread and the live run. */
export type MiniBarState = Pick<AgentViewState, 'turns' | 'run'>;

/** Every moment the mini row has its own answer for, in the order the stories show them. */
export const MINI_MOMENTS = [
  'skeleton',
  'building',
  'stopping',
  'built',
  'partial',
  'stopped',
  'undone',
  'editRunning',
  'edited',
  'proposal',
  'failed',
  'answer',
  'idle',
] as const;

export type MiniMoment = (typeof MINI_MOMENTS)[number];

/** The run's start, 72 seconds before now: the §3.16 frame's clock reads 1:12. */
const STARTED_AT = FIXTURE_NOW - 72_000;

function run(
  turnId: string,
  activity: RunBarView['activity'],
  statusKey: RunBarView['statusKey'],
  params: RunBarView['params'] = {},
  stopping = false,
): RunBarView {
  return { turnId, activity, statusKey, params, startedAt: STARTED_AT, stopping };
}

function userTurn(locale: Locale, turnId: string): TurnView {
  return {
    kind: 'user',
    view: {
      turnId,
      text: CONVERSATIONS[0]?.title[locale] ?? '',
      chips: [],
      notRun: false,
    },
  };
}

function withRequest(locale: Locale, record: TurnView): readonly TurnView[] {
  return [userTurn(locale, 'turn-request'), record];
}

function editRecord(locale: Locale, overrides: Partial<EditRecordView>): EditRecordView {
  return {
    turnId: 'turn-edit',
    phase: 'done',
    origin: 'request',
    target: SECTIONS[locale][1],
    changes: [],
    menu: [],
    ...overrides,
  };
}

function proposalRecord(locale: Locale): ProposalView {
  return {
    turnId: 'turn-proposal',
    status: 'ready',
    target: SECTIONS[locale][1],
    changes: [],
    pageUnchanged: true,
    previewing: true,
    menu: [],
  };
}

/** A words-only answer: nothing on the page changed. */
const ANSWER: Readonly<Record<Locale, string>> = {
  en: 'The booking button is in the hero and again in the contact section.',
  ar: 'زر الحجز في الواجهة، ومرة ثانية في قسم التواصل.',
};

function errorRecord(): ErrorView {
  return {
    turnId: 'turn-error',
    failure: 'unreachable',
    pageState: { kind: 'unchanged' },
    retryable: true,
    details: 'fetch failed: ECONNREFUSED 127.0.0.1:8788',
    menu: [],
  };
}

/** The thread and the run for one mini-row moment, in `locale`. */
export function miniState(moment: MiniMoment, locale: Locale): MiniBarState {
  switch (moment) {
    case 'skeleton':
      return {
        turns: withRequest(locale, { kind: 'build', view: buildRecord('skeleton', []) }),
        run: run('turn-build', 'build', 'build.started'),
      };
    case 'building':
      return {
        turns: withRequest(locale, {
          kind: 'build',
          view: buildRecord('building', clinicRows(locale, PARALLEL_STATES)),
        }),
        run: run('turn-build', 'build', 'build.writing', { n: 4 }),
      };
    case 'stopping':
      return {
        turns: withRequest(locale, {
          kind: 'build',
          view: buildRecord(
            'stopping',
            clinicRows(locale, [
              'landed',
              'landed',
              'landed',
              'drafted',
              'writing',
              'writing',
              'waiting',
              'waiting',
            ]),
          ),
        }),
        run: run('turn-build', 'build', 'stopping', {}, true),
      };
    case 'built':
      return {
        turns: withRequest(locale, {
          kind: 'build',
          view: buildRecord('done', clinicRows(locale, Array<RowState>(8).fill('landed')), {
            elapsedMs: 141_000,
            actions: { ...NO_ACTIONS, undoBuild: true },
          }),
        }),
        run: null,
      };
    case 'partial':
      return {
        turns: withRequest(locale, {
          kind: 'build',
          view: buildRecord(
            'partial',
            clinicRows(locale, [
              'landed',
              'landed',
              'landed',
              'landed',
              'failed',
              'landed',
              'landed',
              'landed',
            ]),
            { elapsedMs: 160_000, actions: { ...NO_ACTIONS, undoBuild: true, retryFailed: 1 } },
          ),
        }),
        run: null,
      };
    case 'stopped':
      return {
        turns: withRequest(locale, {
          kind: 'build',
          view: buildRecord(
            'stopped',
            clinicRows(locale, [
              'landed',
              'landed',
              'landed',
              'notWritten',
              'notWritten',
              'notWritten',
              'notWritten',
              'notWritten',
            ]),
            {
              stopReason: 'signal',
              elapsedMs: 64_000,
              actions: { ...NO_ACTIONS, finishRest: 5, removeEmpty: 5 },
            },
          ),
        }),
        run: null,
      };
    case 'undone':
      return {
        turns: withRequest(locale, {
          kind: 'build',
          view: buildRecord('undone', clinicRows(locale, Array<RowState>(8).fill('undone')), {
            elapsedMs: 141_000,
            actions: { ...NO_ACTIONS, redoBuild: true },
          }),
        }),
        run: null,
      };
    case 'editRunning':
      return {
        turns: withRequest(locale, {
          kind: 'edit',
          view: editRecord(locale, { phase: 'running', stage: 'edit.checking' }),
        }),
        run: run('turn-edit', 'edit', 'edit.checking'),
      };
    case 'edited':
      return {
        turns: withRequest(locale, {
          kind: 'edit',
          view: editRecord(locale, {
            elapsedMs: 16_000,
            undo: { kind: 'undo', transactionId: 'tx-edit' },
            revealNodeId: 'node-2',
          }),
        }),
        run: null,
      };
    case 'proposal':
      return {
        turns: withRequest(locale, { kind: 'proposal', view: proposalRecord(locale) }),
        run: null,
      };
    case 'failed':
      return { turns: withRequest(locale, { kind: 'error', view: errorRecord() }), run: null };
    case 'answer':
      return {
        turns: withRequest(locale, {
          kind: 'answer',
          view: { turnId: 'turn-answer', text: ANSWER[locale], menu: ['copyAnswer'] },
        }),
        run: null,
      };
    case 'idle':
      return { turns: [], run: null };
  }
}
