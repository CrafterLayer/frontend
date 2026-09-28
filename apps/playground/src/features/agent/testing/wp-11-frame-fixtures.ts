/**
 * View fixtures for the frame leaves (WP-11): AgentHeader, LiveStatus, AgentThread,
 * JumpToLatest, EmptyState and SuggestionList. Stories and tests only.
 *
 * Every value is a view as the controller hands it to the panel (`model/view-types.ts`),
 * built the way the model builds it: starters come from `starterSuggestions`, the model's
 * follow-ups go through `followUpSuggestions`, and the selection rows are the catalog's own
 * `suggest.*` sentences. The fixtures author only what a person or the page would have
 * written: the requests, the section titles, the before and after of each change, and the
 * model's follow-ups. Each locale's set is written in its own language, not translated,
 * and the person's requests are written the way people type them (the Arabic ones in the
 * dialect a Levantine owner would use), because that is what the thread has to hold.
 *
 * One clinic page runs through all of it (SPEC §3.4, §3.15): eight sections, a finished
 * build, two edits, then a live build or a live edit, so every story shows the same page.
 */
import { t } from '../copy';
import { followUpSuggestions, starterSuggestions } from '../model/suggestions';
import type {
  AnnouncementView,
  BuildRecordView,
  ChangeLineView,
  EditRecordView,
  EmptyStateView,
  Locale,
  PlanView,
  RowState,
  RunActivity,
  SpineRowView,
  SuggestionView,
  TurnView,
} from '../model/view-types';

/* ── The page and the person, per locale ─────────────────────────────────────── */

interface Script {
  /** The clinic page's eight sections, in page order. */
  readonly sections: readonly string[];
  /** The direction line's prose (SPEC §7.6 E7: no structured direction yet). */
  readonly mood: string;
  /** What the person typed, turn by turn. */
  readonly requests: {
    readonly build: string;
    readonly hero: string;
    readonly services: string;
    readonly contact: string;
    readonly rebuild: string;
  };
  readonly heroChanges: readonly ChangeLineView[];
  readonly servicesChanges: readonly ChangeLineView[];
  /** The model's follow-ups after the last edit, in the person's voice (SPEC §4.16). */
  readonly followUps: readonly string[];
  /**
   * What a page with content offers before anything is selected: block example prompts
   * from the catalog, which block authors write as requests a person would make.
   */
  readonly catalog: readonly string[];
}

const SCRIPTS: Readonly<Record<Locale, Script>> = {
  en: {
    sections: ['Header', 'Hero', 'Services', 'Why us', 'Doctors', 'Testimonials', 'FAQ', 'Contact'],
    mood: 'Calm, clinical, teal',
    requests: {
      build: 'A dental clinic page in Amman, with WhatsApp booking',
      hero: 'Make the hero dark and add a WhatsApp button',
      services: 'Shorten the services copy and keep it friendly',
      contact: 'Add opening hours and a map to the contact section',
      rebuild: 'Rebuild it for a children’s dental clinic, same colours',
    },
    heroChanges: [
      { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
      { kind: 'added', label: 'Button', value: 'WhatsApp' },
    ],
    servicesChanges: [
      {
        kind: 'changed',
        label: 'Heading',
        before: 'Our comprehensive range of dental services',
        after: 'What we treat',
      },
      {
        kind: 'changed',
        label: 'Text',
        before: 'We offer a wide range of treatments for patients of every age',
        after: 'Checkups, implants, braces and whitening',
      },
    ],
    followUps: [
      'Add a pricing section with three plans',
      'Put the booking button in the header too',
      'Write shorter bios for the doctors',
    ],
    catalog: [
      'Add a testimonials row with three patient quotes',
      'Add an FAQ about first visits and prices',
      'Add a before-and-after gallery',
      'Add a team section with photos and roles',
    ],
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
    mood: 'هادئ، طبّي، فيروزي',
    requests: {
      build: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
      hero: 'خلّي الواجهة داكنة وضيف زر واتساب',
      services: 'اختصر نصوص الخدمات وخلّيها ودودة',
      contact: 'ضيف ساعات الدوام وخريطة على قسم التواصل',
      rebuild: 'أعد بناء الصفحة لعيادة أسنان أطفال، بنفس الألوان',
    },
    heroChanges: [
      { kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'كحلي داكن' },
      { kind: 'added', label: 'الزر', value: 'واتساب' },
    ],
    servicesChanges: [
      {
        kind: 'changed',
        label: 'العنوان',
        before: 'خدماتنا الشاملة في طب الأسنان',
        after: 'ما نعالجه',
      },
      {
        kind: 'changed',
        label: 'النص',
        before: 'نقدّم مجموعة واسعة من العلاجات للمرضى من كل الأعمار',
        after: 'فحوص دورية، زراعة، تقويم وتبييض',
      },
    ],
    followUps: [
      'إضافة قسم للأسعار بثلاث باقات',
      'وضع زر الحجز في الترويسة أيضًا',
      'تقصير نبذات الأطباء',
    ],
    catalog: [
      'إضافة آراء المرضى في صف من ثلاث بطاقات',
      'إضافة أسئلة شائعة عن الزيارة الأولى والأسعار',
      'إضافة معرض صور قبل العلاج وبعده',
      'إضافة قسم للفريق بالصور والتخصصات',
    ],
  },
};

/** The clinic page's section titles, in page order. */
export function frameSections(locale: Locale): readonly string[] {
  return SCRIPTS[locale].sections;
}

/** The selected block the selection stories name: the hero, by its title on the page. */
export function frameSelectedTitle(locale: Locale): string {
  return SCRIPTS[locale].sections[1] ?? '';
}

/* ── Records ─────────────────────────────────────────────────────────────────── */

const NO_BUILD_ACTIONS = {
  undoBuild: false,
  redoBuild: false,
  finishRest: 0,
  removeEmpty: 0,
  retryFailed: 0,
} as const;

function spineRows(locale: Locale, turnId: string, states: readonly RowState[]): SpineRowView[] {
  const titles = SCRIPTS[locale].sections;
  return titles.map((title, index) => {
    const state = states[index] ?? 'waiting';
    const landed = state === 'landed';
    return {
      key: `${turnId}-s${String(index + 1)}`,
      nodeId: landed ? `${turnId}-node-${String(index + 1)}` : undefined,
      position: index + 1,
      total: titles.length,
      title,
      state,
      undo: undefined,
      canRetry: false,
    };
  });
}

/** The first build, finished: every section on the page, collapsed under newer turns. */
function builtPage(locale: Locale, turnId: string, collapsed: boolean): BuildRecordView {
  const rows = spineRows(
    locale,
    turnId,
    Array.from({ length: SCRIPTS[locale].sections.length }, (): RowState => 'landed'),
  );
  return {
    turnId,
    phase: 'done',
    landed: rows.length,
    total: rows.length,
    elapsedMs: 141_000,
    remainingMs: null,
    direction: { mood: SCRIPTS[locale].mood },
    rows,
    facts: [],
    collapsed,
    revived: false,
    actions: { ...NO_BUILD_ACTIONS, undoBuild: true },
    menu: ['reuse', 'copySummary'],
  };
}

/**
 * A live build, as SPEC §3.14 draws it: one section on the page, four writers, one draft
 * waiting its turn, two sections not started. Ink means landed, so `landed` is 1.
 */
function buildingPage(locale: Locale, turnId: string): BuildRecordView {
  const rows = spineRows(locale, turnId, [
    'landed',
    'retrying',
    'writing',
    'drafted',
    'writing',
    'writing',
    'waiting',
    'waiting',
  ]);
  return {
    turnId,
    phase: 'building',
    landed: 1,
    total: rows.length,
    remainingMs: 120_000,
    direction: { mood: SCRIPTS[locale].mood },
    rows,
    facts: [],
    collapsed: false,
    revived: false,
    actions: NO_BUILD_ACTIONS,
    menu: [],
  };
}

function editDone(
  turnId: string,
  target: string,
  changes: readonly ChangeLineView[],
  elapsedMs: number,
): EditRecordView {
  return {
    turnId,
    phase: 'done',
    origin: 'request',
    target,
    changes,
    elapsedMs,
    revealNodeId: `${turnId}-node`,
    undo: { kind: 'undo', transactionId: `${turnId}-tx` },
    menu: ['reuse', 'copySummary'],
  };
}

function editRunning(turnId: string, target: string): EditRecordView {
  return {
    turnId,
    phase: 'running',
    origin: 'request',
    target,
    stage: 'edit.writing',
    changes: [],
    menu: [],
  };
}

function user(turnId: string, text: string): TurnView {
  return { kind: 'user', view: { turnId, text, chips: [], notRun: false } };
}

/* ── Conversations ───────────────────────────────────────────────────────────── */

/**
 * The clinic conversation (SPEC §3.12): the first build, two finished edits, and, when a
 * run is live, the request it is running. `live` picks what that run is, and so what the
 * jump pill says: `null` ends on the second edit (the pill reads "Latest"), `build` on a
 * rebuild in progress ("Building"), `edit` on an edit in progress ("Editing").
 */
export function frameConversation(
  locale: Locale,
  live: Extract<RunActivity, 'build' | 'edit'> | null = null,
): readonly TurnView[] {
  const script = SCRIPTS[locale];
  const hero = script.sections[1] ?? '';
  const services = script.sections[2] ?? '';
  const contact = script.sections[7] ?? '';
  const settled: readonly TurnView[] = [
    user('u1', script.requests.build),
    { kind: 'build', view: builtPage(locale, 'b1', true) },
    user('u2', script.requests.hero),
    { kind: 'edit', view: editDone('e2', hero, script.heroChanges, 16_000) },
    user('u3', script.requests.services),
    { kind: 'edit', view: editDone('e3', services, script.servicesChanges, 22_000) },
  ];
  if (live === 'build') {
    return [
      ...settled,
      user('u4', script.requests.rebuild),
      { kind: 'build', view: buildingPage(locale, 'b4') },
    ];
  }
  if (live === 'edit') {
    return [
      ...settled,
      user('u4', script.requests.contact),
      { kind: 'edit', view: editRunning('e4', contact) },
    ];
  }
  return settled;
}

/** A short conversation: one request and its finished build, not collapsed. */
export function frameFirstBuild(locale: Locale): readonly TurnView[] {
  return [
    user('u1', SCRIPTS[locale].requests.build),
    { kind: 'build', view: builtPage(locale, 'b1', false) },
  ];
}

/**
 * A page plan waiting for the person (SPEC §3.7): a decision surface, so the suggestion
 * rows hide until it is answered (SPEC §4.16).
 */
export function framePlanWaiting(locale: Locale): readonly TurnView[] {
  const script = SCRIPTS[locale];
  const plan: PlanView = {
    turnId: 'p2',
    status: 'ready',
    approval: false,
    edited: false,
    editable: true,
    note: 'exact',
    subject: script.requests.build,
    direction: { mood: script.mood },
    sections: script.sections.map((title, index) => ({
      key: `p2-s${String(index + 1)}`,
      title,
    })),
    problems: [],
  };
  return [user('u1', script.requests.build), { kind: 'page-plan', view: plan }];
}

/* ── The empty thread ────────────────────────────────────────────────────────── */

/** The three greetings (SPEC §4.16): an empty page, a page with content, a selection. */
export function frameEmptyViews(locale: Locale): {
  readonly greeting: EmptyStateView;
  readonly hasContent: EmptyStateView;
  readonly selection: EmptyStateView;
} {
  return {
    greeting: { kind: 'greeting' },
    hasContent: { kind: 'hasContent', sections: SCRIPTS[locale].sections.length },
    selection: { kind: 'selection', title: frameSelectedTitle(locale) },
  };
}

/* ── Suggestions ─────────────────────────────────────────────────────────────── */

function catalogRows(texts: readonly string[]): readonly SuggestionView[] {
  return texts.map((text): SuggestionView => ({ key: `catalog:${text}`, text, source: 'catalog' }));
}

/**
 * Each source's rows, at the SPEC §4.16 limits (4 in the empty state, 3 after a run):
 * - `starters`: an empty page, the authored starters (`starterSuggestions`);
 * - `hasContent`: a page with content and nothing selected, the catalog's example
 *   prompts;
 * - `selection`: the hero selected, an AI-built region, so the two region actions
 *   `selectionSuggestions` offers (tighten, relayout), then the catalog's first;
 * - `afterRun`: after the second edit, the model's follow-ups.
 */
export function frameSuggestions(locale: Locale): {
  readonly starters: readonly SuggestionView[];
  readonly hasContent: readonly SuggestionView[];
  readonly selection: readonly SuggestionView[];
  readonly afterRun: readonly SuggestionView[];
} {
  const script = SCRIPTS[locale];
  const title = frameSelectedTitle(locale);
  return {
    starters: starterSuggestions(locale),
    hasContent: catalogRows(script.catalog),
    selection: [
      {
        key: 'selection:tighten',
        text: t(locale, 'suggest.tighten', { title }),
        source: 'selection',
      },
      {
        key: 'selection:relayout',
        text: t(locale, 'suggest.relayout', { title }),
        source: 'selection',
      },
      ...catalogRows(script.catalog.slice(0, 1)),
    ],
    afterRun: followUpSuggestions(script.followUps),
  };
}

/* ── What the live region says ───────────────────────────────────────────────── */

/**
 * One build's announcements, in the order LiveStatus receives them (SPEC §4.3): the start,
 * the layout, landings coalesced into progress, a blocked section after 10s, the outcome;
 * then a queued request, and "Copied" twice, the same sentence spoken twice because `seq`
 * rose. Never the clock, the estimate or an edit sub-stage.
 */
export function frameAnnouncements(locale: Locale): readonly AnnouncementView[] {
  const blocked = SCRIPTS[locale].sections[2] ?? '';
  return [
    { key: 'build.started', params: {}, seq: 1 },
    { key: 'build.planned', params: { n: 8 }, seq: 2 },
    { key: 'build.progress', params: { done: 1, total: 8 }, seq: 3 },
    { key: 'build.blocked', params: { title: blocked }, seq: 4 },
    { key: 'build.progress', params: { done: 5, total: 8 }, seq: 5 },
    { key: 'build.done', params: { n: 8 }, seq: 6 },
    { key: 'queue.queued', params: {}, seq: 7 },
    { key: 'copied', params: {}, seq: 8 },
    { key: 'copied', params: {}, seq: 9 },
  ];
}
