/**
 * View fixtures for the composer family's stories and tests (WP-14): Composer, RunBar,
 * StopButton, QueueHeader, ContextChip, MentionMenu, ComposerToolbar, ModeMenu, ModelMenu,
 * SendButton, EnhanceButton, EnhanceNote, ClarifyPanel.
 *
 * Views only, in both locales, written the way the controller writes them: the person's
 * own words (a draft, a queued request) in the person's register, everything the
 * instrument says left to the catalog. Nothing here counts a noun in Arabic; a count is a
 * number the component formats.
 */
import type { ComposerActions, ComposerView } from '../components/Composer/Composer';
import { modelSelection } from '../model/model-label';
import { sendState, type RunLife } from '../model/send-state';
import type {
  BlockChipView,
  ClarifyQuestionView,
  ClarifyView,
  ContextChipView,
  EnhancementView,
  Locale,
  MentionView,
  ModelSelectionView,
  QueueStatus,
  QueueView,
  RunBarView,
  ScopeChipView,
  StatusKey,
  CopyParams,
} from '../model/view-types';

/* ── Chips ─────────────────────────────────────────────────────────────────── */

/** The "Whole page" scope chip (FR-024): what a request with no selection is about. */
export const SCOPE_CHIP: ScopeChipView = { kind: 'page', id: 'scope:page' };

const BLOCK_LABELS: Readonly<Record<Locale, Readonly<Record<'hero' | 'services' | 'faq', string>>>> =
  {
    ar: { hero: 'الواجهة', services: 'الخدمات', faq: 'الأسئلة الشائعة' },
    en: { hero: 'Hero', services: 'Services', faq: 'FAQ' },
  };

/** A block chip for one of the fixture page's sections. */
export function blockChip(
  locale: Locale,
  block: 'hero' | 'services' | 'faq',
  overrides: Partial<BlockChipView> = {},
): BlockChipView {
  return {
    kind: 'selection',
    id: `node-${block}`,
    label: BLOCK_LABELS[locale][block],
    stale: false,
    ...overrides,
  };
}

/** A label long enough to meet the chip's 16-character ellipsis. */
export const LONG_LABEL: Readonly<Record<Locale, string>> = {
  ar: 'قسم آراء المرضى وقصص النجاح',
  en: 'Patient stories and reviews',
};

/* ── The person's words ────────────────────────────────────────────────────── */

/** A draft as a person types it, in each locale. */
export const DRAFT: Readonly<Record<Locale, string>> = {
  ar: 'اجعل الترويسة ثابتة عند التمرير',
  en: 'Make the header sticky',
};

/** An English request typed into the Arabic panel: the box's direction follows the words. */
export const LATIN_DRAFT = 'Build a site for a coffee roaster in Irbid';

/** An Arabic request typed into the English panel. */
export const ARABIC_DRAFT = 'صفحة لمقهى مختص في إربد';

/** A draft long enough to pass six lines and scroll. */
export const LONG_DRAFT: Readonly<Record<Locale, string>> = {
  ar: [
    'صفحة لعيادة أسنان في عمّان.',
    'ترويسة فيها الشعار ورقم الهاتف.',
    'واجهة بصورة للعيادة وزر حجز عبر واتساب.',
    'قسم للخدمات: تقويم وزراعة وتبييض.',
    'قسم للأطباء مع صورهم.',
    'آراء المرضى، ثم الأسئلة الشائعة.',
    'وفي الأسفل الخريطة ومواعيد الدوام.',
  ].join('\n'),
  en: [
    'A page for a dental clinic in Amman.',
    'A header with the logo and the phone number.',
    'A hero with a photo of the clinic and a WhatsApp booking button.',
    'Services: braces, implants and whitening.',
    'The doctors, with their photos.',
    'Patient reviews, then the FAQ.',
    'At the bottom, the map and opening hours.',
  ].join('\n'),
};

/* ── The run ───────────────────────────────────────────────────────────────── */

/** How long the fixture run has been going when a story opens: the clock reads 1:12. */
export const RUN_AGE_MS = 72_000;

/**
 * A live run for the RunBar: by default four sections being written (SPEC §3.4). The
 * clock is measured from `now`, which a story passes as the moment it renders.
 */
export function liveRun(
  now: number,
  statusKey: StatusKey = 'build.writing',
  params: CopyParams = { n: 4 },
  overrides: Partial<RunBarView> = {},
): RunBarView {
  return {
    turnId: 'turn-build',
    activity: statusKey.startsWith('edit.') ? 'edit' : 'build',
    statusKey,
    params,
    startedAt: now - RUN_AGE_MS,
    stopping: false,
    ...overrides,
  };
}

/** The same run after Stop was pressed and before the engine settled (SPEC §3.10). */
export function stoppingRun(now: number): RunBarView {
  return liveRun(now, 'stopping', {}, { stopping: true });
}

/* ── The queue ─────────────────────────────────────────────────────────────── */

/** The one queued request, in any of its four states (SPEC §3.9, §3.10). */
export function queued(locale: Locale, status: QueueStatus = 'editable'): QueueView {
  return {
    text: DRAFT[locale],
    chips: status === 'paused' ? [blockChip(locale, 'hero')] : [SCOPE_CHIP],
    status,
  };
}

/* ── Mentions ──────────────────────────────────────────────────────────────── */

/** The `@` list, open on a fragment, sections first with their place (SPEC §3.2). */
export const MENTION: Readonly<Record<Locale, MentionView>> = {
  ar: {
    query: 'ال',
    candidates: [
      { id: 'node-hero', label: 'الواجهة', section: { position: 2, total: 8 } },
      { id: 'node-services', label: 'الخدمات', section: { position: 3, total: 8 } },
      { id: 'node-doctors', label: 'الأطباء', section: { position: 5, total: 8 } },
      { id: 'node-booking', label: 'الحجز عبر واتساب' },
    ],
  },
  en: {
    query: 'se',
    candidates: [
      { id: 'node-services', label: 'Services', section: { position: 3, total: 8 } },
      { id: 'node-social', label: 'Social proof', section: { position: 6, total: 8 } },
      { id: 'node-session', label: 'Session prices' },
    ],
  },
};

/** An `@` fragment that matches nothing. */
export const MENTION_EMPTY: Readonly<Record<Locale, MentionView>> = {
  ar: { query: 'سعر', candidates: [] },
  en: { query: 'pricing', candidates: [] },
};

/* ── Models ────────────────────────────────────────────────────────────────── */

/** The ids a host offers, raw: the menu must never show them. */
export const MODEL_IDS = ['cli:haiku', 'cli:sonnet', 'minimax/minimax-m3:free'] as const;

function requireSelection(selection: ModelSelectionView | null): ModelSelectionView {
  if (selection === null) throw new Error('the fixture ids must offer a choice');
  return selection;
}

/** The picker, through `model-label.ts`, with the fast model chosen. */
export const MODEL: ModelSelectionView = requireSelection(modelSelection(MODEL_IDS, 'cli:haiku'));

/* ── ✨ Improve ─────────────────────────────────────────────────────────────── */

/** The draft before Improve, as the owner might type it. */
export const ROUGH_DRAFT: Readonly<Record<Locale, string>> = {
  ar: 'خلي الهيرو اغمق وحط زر واتس',
  en: 'make hero darker + whatsapp btn',
};

/** The rewrite Improve puts in the box. */
export const IMPROVED_DRAFT: Readonly<Record<Locale, string>> = {
  ar: 'اجعل خلفية قسم الواجهة أغمق، وأضف زر حجز عبر واتساب أسفل العنوان.',
  en: 'Make the hero background darker and add a WhatsApp booking button below the headline.',
};

/** Every Improve state (the view's union), per locale. */
export function enhancement(
  locale: Locale,
  status: EnhancementView['status'],
): EnhancementView {
  switch (status) {
    case 'unavailable':
    case 'idle':
    case 'enhancing':
      return { status };
    case 'failed':
      return { status, reason: 'unreachable' };
    case 'enhanced':
      return locale === 'ar'
        ? {
            status,
            understood: 'واجهة أغمق مع زر حجز عبر واتساب',
            changes: [
              'سُمّي القسم باسمه: الواجهة',
              'حُدّد مكان الزر: أسفل العنوان',
              'صُحّحت كتابة «واتساب»',
            ],
            canRestore: true,
          }
        : {
            status,
            understood: 'A darker hero with a WhatsApp booking button',
            changes: [
              'Named the section: the hero',
              'Placed the button below the headline',
              'Spelled out “button”',
            ],
            canRestore: true,
          };
  }
}

/* ── Questions before guessing ─────────────────────────────────────────────── */

const QUESTIONS: Readonly<Record<Locale, readonly ClarifyQuestionView[]>> = {
  ar: [
    { id: 'q-page', text: 'أي صفحة يفتحها الرابط؟', choices: ['الخدمات', 'تواصل معنا', 'الحجز'] },
    {
      id: 'q-place',
      text: 'أين يوضع الرابط؟',
      choices: ['في الترويسة', 'في الواجهة', 'في آخر الصفحة'],
    },
    { id: 'q-look', text: 'كيف يظهر؟', choices: ['زر', 'رابط نصي'] },
  ],
  en: [
    {
      id: 'q-page',
      text: 'Which page should the link open?',
      choices: ['Services', 'Contact us', 'Booking'],
    },
    {
      id: 'q-place',
      text: 'Where should the link go?',
      choices: ['In the header', 'In the hero', 'At the end of the page'],
    },
    { id: 'q-look', text: 'How should it look?', choices: ['A button', 'A text link'] },
  ],
};

/** The owner's own unclear request (2026-09-28), and an English one like it. */
export const UNCLEAR_REQUEST: Readonly<Record<Locale, string>> = {
  ar: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
  en: 'can u link this page to the one inside',
};

/**
 * The questions docked for an unclear request: `count` of them (1 to 3), the first
 * `answered` already answered, asking or rewriting.
 */
export function clarifying(
  locale: Locale,
  count: 1 | 2 | 3 = 3,
  answered = 0,
  status: ClarifyView['status'] = 'asking',
): ClarifyView {
  return {
    request: UNCLEAR_REQUEST[locale],
    understood:
      locale === 'ar'
        ? 'إضافة رابط من هذه الصفحة إلى صفحة داخلية'
        : 'Add a link from this page to an inner page',
    questions: QUESTIONS[locale].slice(0, count).map((question, index) =>
      index < answered ? { ...question, answer: question.choices[0] } : question,
    ),
    status,
  };
}

/* ── The whole composer ────────────────────────────────────────────────────── */

/**
 * The Composer's view, with the Send slot worked out the way the controller works it out
 * (`sendState`), so a fixture can never draw a Send state its draft and run contradict.
 */
export function composerView(overrides: Partial<ComposerView> = {}): ComposerView {
  const base: ComposerView = {
    locale: 'en',
    draft: '',
    chips: [SCOPE_CHIP],
    mention: null,
    mode: 'auto',
    model: MODEL,
    send: 'idle-empty',
    run: null,
    queue: null,
    enhancement: { status: 'idle' },
    clarify: null,
  };
  const view = { ...base, ...overrides };
  if (overrides.send !== undefined) return view;
  const life: RunLife = view.run === null ? 'idle' : view.run.stopping ? 'stopping' : 'live';
  const isQueued =
    view.queue !== null && view.queue.status !== 'paused' && view.queue.text === view.draft;
  return { ...view, send: sendState({ run: life, draft: view.draft, queued: isQueued }) };
}

/** The chips a locale's fixture view carries by default. */
export function chipsFor(locale: Locale, ...blocks: ('hero' | 'services' | 'faq')[]): readonly ContextChipView[] {
  return blocks.length === 0 ? [SCOPE_CHIP] : blocks.map((block) => blockChip(locale, block));
}

/**
 * Actions that do nothing: a story or a test spreads it and replaces the ones it watches
 * (`{ ...NO_ACTIONS, send: vi.fn() }`), so every one it does not care about still exists.
 */
export const NO_ACTIONS: ComposerActions = {
  setDraft: () => undefined,
  send: () => undefined,
  stop: () => undefined,
  removeQueued: () => undefined,
  continueQueued: () => undefined,
  removeChip: () => undefined,
  addMention: () => undefined,
  setMode: () => undefined,
  setModel: () => undefined,
  enhanceDraft: () => undefined,
  restoreDraft: () => undefined,
  answerClarify: () => undefined,
  sendAsWritten: () => undefined,
  dismissClarify: () => undefined,
  setComposerFocused: () => undefined,
};
