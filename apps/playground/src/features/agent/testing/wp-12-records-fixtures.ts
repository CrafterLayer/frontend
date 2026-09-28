/**
 * View fixtures for the records (SPEC §4.5 to §4.10, §4.14; WP-12): every phase a record can
 * be in, in both locales, shaped exactly as `model/run-view.ts` builds them. Stories and tests
 * only.
 *
 * Each fixture keeps the honesty rules the producer keeps (SPEC §6.5), so a story never shows
 * a state the panel could not reach:
 * - `landed` counts landed rows only; drafted and failed rows are never counted;
 * - landed rows are a prefix of the list while a build runs (the engine lands in page order);
 * - a row carries `undo` only once the build has ended with its landing record, and a
 *   revived record's Undo is `unavailable`;
 * - a live record has no final time (the RunBar owns the one clock).
 *
 * Titles are the page's own words: the English set is the §3.4 frame, the Arabic set its
 * §3.15 mirror. Nothing here writes a number beside a counted Arabic noun (`nouns.ts` owns
 * that), so the copy rules' source scan stays clean.
 */
import type {
  AnswerView,
  BuildActionsView,
  BuildPhase,
  BuildRecordView,
  BuildStopReason,
  ChangeLineView,
  DirectionView,
  EditRecordView,
  EditStageKey,
  EndNoteKey,
  EndNoteView,
  ErrorClass,
  ErrorPageState,
  ErrorView,
  FactView,
  FailureClass,
  Locale,
  RecordMenuItem,
  RowState,
  SpineRowView,
  UndoView,
  UserMessageView,
} from '../model/view-types';

/* ── The page being built ─────────────────────────────────────────────────── */

/** The eight sections of the dental-clinic page (SPEC §3.4, §3.15). */
export const SECTION_TITLES: Readonly<Record<Locale, readonly string[]>> = {
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

/** The page's direction (SPEC §3.4 DirectionLine): five swatches, a mood, a font pair. */
export const DIRECTION: Readonly<Record<Locale, DirectionView>> = {
  en: {
    mood: 'Calm, clinical, teal',
    fonts: 'Reem Kufi / IBM Plex Sans',
    swatches: [
      { role: 'background', hex: '#FBFBFD' },
      { role: 'surface', hex: '#FFFFFF' },
      { role: 'text', hex: '#0E1116' },
      { role: 'accent', hex: '#0F766E' },
      { role: 'onAccent', hex: '#FFFFFF' },
    ],
  },
  ar: {
    mood: 'هادئ، طبّي، فيروزي',
    fonts: 'Reem Kufi / IBM Plex Sans Arabic',
    swatches: [
      { role: 'background', hex: '#FBFBFD' },
      { role: 'surface', hex: '#FFFFFF' },
      { role: 'text', hex: '#0E1116' },
      { role: 'accent', hex: '#0F766E' },
      { role: 'onAccent', hex: '#FFFFFF' },
    ],
  },
};

/** The direction as the engine sends it before structured direction (SPEC §7.6 E7). */
export const DIRECTION_PROSE: Readonly<Record<Locale, DirectionView>> = {
  en: { mood: 'Calm and clinical, with teal accents and generous white space' },
  ar: { mood: 'هادئ وطبّي، بلمسات فيروزية ومساحات بيضاء واسعة' },
};

/** Sample details the writers invented, to replace before publishing (SPEC §3.5). */
export const FACTS: Readonly<Record<Locale, readonly FactView[]>> = {
  en: [
    { sample: '25 JD', section: 'Services', nodeId: 'sec-3' },
    { sample: 'Dr. Lina Haddad', section: 'Doctors', nodeId: 'sec-5' },
    { sample: 'Rated 4.9 by 212 patients', section: 'Testimonials', nodeId: 'sec-6' },
  ],
  ar: [
    { sample: '25 دينارًا', section: 'الخدمات', nodeId: 'sec-3' },
    { sample: 'د. لينا حداد', section: 'الأطباء', nodeId: 'sec-5' },
    { sample: 'تقييم 4.9 من 212 مراجعًا', section: 'آراء المرضى', nodeId: 'sec-6' },
  ],
};

/* ── Spine rows ───────────────────────────────────────────────────────────── */

/** One row as a story or test asks for it; the rest is filled in like `run-view.ts` does. */
export interface RowSpec {
  readonly state: RowState;
  readonly reason?: FailureClass | undefined;
  readonly undo?: UndoView | undefined;
  readonly canRetry?: boolean | undefined;
  /** The section is not on the page (its placeholder was removed): a text row, not a button. */
  readonly offPage?: boolean | undefined;
}

/** The node id and key of section `position` (1-based). */
export function sectionKey(position: number): string {
  return `sec-${String(position)}`;
}

/** Rows for `specs`, titled from the page's sections in `locale`. */
export function spineRows(locale: Locale, specs: readonly (RowSpec | RowState)[]): SpineRowView[] {
  const titles = SECTION_TITLES[locale];
  return specs.map((given, index) => {
    const spec: RowSpec = typeof given === 'string' ? { state: given } : given;
    const position = index + 1;
    const key = sectionKey(position);
    return {
      key,
      ...(spec.offPage === true ? {} : { nodeId: key }),
      position,
      total: specs.length,
      title: titles[index] ?? `Section ${String(position)}`,
      state: spec.state,
      ...(spec.reason === undefined ? {} : { reason: spec.reason }),
      ...(spec.undo === undefined ? {} : { undo: spec.undo }),
      canRetry: spec.canRetry ?? false,
    };
  });
}

/** A landed row's Undo once its build has ended (SPEC §4.8: only after `build.completed`). */
export function undoOf(position: number): UndoView {
  return { kind: 'undo', transactionId: `tx-${String(position)}` };
}

const REVIVED_UNDO: UndoView = { kind: 'unavailable', why: 'revived' };

const NO_ACTIONS: BuildActionsView = {
  undoBuild: false,
  redoBuild: false,
  finishRest: 0,
  removeEmpty: 0,
  retryFailed: 0,
};

/** The settled build menu, as `settledMenu` writes it for a record with later page changes. */
const BUILD_MENU: readonly RecordMenuItem[] = ['restore', 'reuse', 'copySummary'];

function countLanded(rows: readonly SpineRowView[]): number {
  return rows.filter((row) => row.state === 'landed').length;
}

function build(
  locale: Locale,
  phase: BuildPhase,
  rows: readonly SpineRowView[],
  rest: Partial<BuildRecordView> = {},
): BuildRecordView {
  return {
    turnId: `build-${phase}`,
    phase,
    landed: countLanded(rows),
    total: rows.length,
    remainingMs: null,
    rows,
    facts: [],
    collapsed: false,
    revived: false,
    actions: NO_ACTIONS,
    menu: [],
    ...rest,
    ...(rest.direction === undefined && (phase === 'building' || phase === 'done')
      ? { direction: DIRECTION[locale] }
      : {}),
  };
}

/* ── Build records, one per phase of SPEC §4.8 ────────────────────────────── */

/** §3.3: laying out the page; no sections exist yet, so nothing is counted. */
export function buildSkeleton(locale: Locale): BuildRecordView {
  return build(locale, 'skeleton', [], { direction: undefined });
}

/** §3.4: one of eight on the page, five writers, one draft waiting its turn. */
export function buildBuilding(locale: Locale): BuildRecordView {
  return build(
    locale,
    'building',
    spineRows(locale, [
      'landed',
      'writing',
      'writing',
      'drafted',
      'writing',
      'writing',
      'waiting',
      'waiting',
    ]),
    { remainingMs: 90_000 },
  );
}

/** §3.14: every state a live row can be in, "Second try" included. */
export function buildEveryRowState(locale: Locale): BuildRecordView {
  return build(
    locale,
    'building',
    spineRows(locale, [
      'landed',
      'retrying',
      'writing',
      'drafted',
      'writing',
      'writing',
      'waiting',
      'waiting',
    ]),
    { remainingMs: 90_000 },
  );
}

/**
 * §3.4 "Blocked": one section is still being written and the drafts below it wait their turn.
 * The RunBar and the live region say it; the record shows it as it is.
 */
export function buildBlocked(locale: Locale): BuildRecordView {
  return build(
    locale,
    'building',
    spineRows(locale, [
      'landed',
      'writing',
      'drafted',
      'drafted',
      'drafted',
      'drafted',
      'writing',
      'waiting',
    ]),
    { remainingMs: 45_000 },
  );
}

/** Stop pressed, the engine not yet settled: the record keeps its count and says nothing more. */
export function buildStopping(locale: Locale): BuildRecordView {
  return build(
    locale,
    'stopping',
    spineRows(locale, [
      'landed',
      'landed',
      'writing',
      'drafted',
      'writing',
      'waiting',
      'waiting',
      'waiting',
    ]),
  );
}

/** §3.5: every section landed, one unbroken stroke; Undo per row, Undo build, facts. */
export function buildDone(locale: Locale): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((_, index) => ({ state: 'landed', undo: undoOf(index + 1) })),
  );
  return build(locale, 'done', rows, {
    elapsedMs: 141_000,
    facts: FACTS[locale],
    actions: { ...NO_ACTIONS, undoBuild: true },
    menu: BUILD_MENU,
  });
}

/** §3.5 partial: section 5 failed (timed out); Retry on its row, "Write the failed section again". */
export function buildPartial(locale: Locale): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((_, index): RowSpec =>
      index === 4
        ? { state: 'failed', reason: 'timeout', canRetry: true }
        : { state: 'landed', undo: undoOf(index + 1) },
    ),
  );
  return build(locale, 'partial', rows, {
    elapsedMs: 160_000,
    actions: { ...NO_ACTIONS, undoBuild: true, retryFailed: 1 },
    menu: BUILD_MENU,
  });
}

/** §3.10: stopped with five on the page and three not written, by `reason`. */
export function buildStopped(locale: Locale, reason: BuildStopReason = 'signal'): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((_, index): RowSpec =>
      index < 5 ? { state: 'landed', undo: undoOf(index + 1) } : { state: 'notWritten' },
    ),
  );
  return build(locale, 'stopped', rows, {
    turnId: `build-stopped-${reason}`,
    stopReason: reason,
    elapsedMs: 112_000,
    actions: { ...NO_ACTIONS, finishRest: 3, removeEmpty: 3 },
    menu: ['reuse', 'copySummary'],
  });
}

/**
 * Reloaded mid-build: three landed before the reload. `resumable` means the section list was
 * saved, so "Finish the rest" can run; without it the caption says why it cannot.
 */
export function buildInterrupted(locale: Locale, resumable: boolean): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((_, index): RowState => (index < 3 ? 'landed' : 'notWritten')),
  );
  return build(locale, 'interrupted', rows, {
    turnId: `build-interrupted-${resumable ? 'resumable' : 'lost'}`,
    revived: true,
    actions: { ...NO_ACTIONS, finishRest: resumable ? 5 : 0, removeEmpty: 5 },
    menu: ['reuse', 'copySummary'],
  });
}

/** Failed before any section landed: the server never answered; the empty layout remains. */
export function buildFailed(locale: Locale): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((): RowState => 'notWritten'),
  );
  return build(locale, 'failed', rows, {
    elapsedMs: 31_000,
    menu: ['reuse', 'copyError'],
    error: {
      failure: 'unreachable',
      pageState: { kind: 'skeleton' },
      retryable: true,
      details: 'remote/unreachable: The assistant server could not be reached.',
    },
  });
}

/** Undo build ran: nothing of it is on the page; Redo build while the redo is valid. */
export function buildUndone(locale: Locale): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((): RowState => 'undone'),
  );
  return build(locale, 'undone', rows, {
    elapsedMs: 141_000,
    actions: { ...NO_ACTIONS, redoBuild: true },
    menu: ['reuse', 'copySummary'],
  });
}

/** A finished build read back after a reload: its Undo is shown unavailable, and explained. */
export function buildRevived(locale: Locale): BuildRecordView {
  const rows = spineRows(
    locale,
    SECTION_TITLES[locale].map((): RowSpec => ({ state: 'landed', undo: REVIVED_UNDO })),
  );
  return build(locale, 'done', rows, {
    turnId: 'build-revived',
    elapsedMs: 141_000,
    revived: true,
    menu: ['reuse', 'copySummary'],
  });
}

/** An older finished build, folded because a newer turn exists (SPEC §3.2, §4.4). */
export function buildCollapsed(locale: Locale): BuildRecordView {
  return { ...buildDone(locale), turnId: 'build-collapsed', collapsed: true };
}

/**
 * A row whose Undo was refused (`revertBuildSection` said `changed-since`): it keeps its ink
 * and says why, and its neighbour was undone and can be redone.
 */
export function buildAfterRowUndo(locale: Locale): BuildRecordView {
  const view = buildDone(locale);
  const rows = view.rows.map((row) => {
    if (row.position === 2) return { ...row, state: 'undone' as const, undo: { kind: 'redo' as const, transactionId: 'tx-undo-2' } };
    if (row.position === 3)
      return { ...row, undo: { kind: 'unavailable' as const, why: 'changedSince' as const } };
    return row;
  });
  return { ...view, turnId: 'build-row-undo', rows, landed: countLanded(rows) };
}

/* ── Edit records (SPEC §4.9) ─────────────────────────────────────────────── */

const HERO: Readonly<Record<Locale, string>> = { en: 'Hero', ar: 'الواجهة' };

/** The hero edit of §3.6: a darker background, and a WhatsApp button. */
export const HERO_CHANGES: Readonly<Record<Locale, readonly ChangeLineView[]>> = {
  en: [
    { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
    { kind: 'added', label: 'Button', value: 'WhatsApp' },
  ],
  ar: [
    { kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'كحلي داكن' },
    { kind: 'added', label: 'الزر', value: 'واتساب' },
  ],
};

/** Five changes: three lines, then "Show all changes (5)". */
export const MANY_CHANGES: Readonly<Record<Locale, readonly ChangeLineView[]>> = {
  en: [
    ...HERO_CHANGES.en,
    { kind: 'changed', label: 'Heading', before: 'Welcome', after: 'Your new smile starts today' },
    { kind: 'removed', label: 'Subtitle', value: 'Book online in a minute' },
    { kind: 'restyled', label: 'Section', value: 'Hero' },
  ],
  ar: [
    ...HERO_CHANGES.ar,
    { kind: 'changed', label: 'العنوان', before: 'أهلًا بكم', after: 'ابتسامتك الجديدة تبدأ اليوم' },
    { kind: 'removed', label: 'العنوان الفرعي', value: 'احجز خلال دقيقة' },
    { kind: 'restyled', label: 'القسم', value: 'الواجهة' },
  ],
};

/** A one-word title change, the direct edit that costs no model call (instant). */
export const TITLE_CHANGE: Readonly<Record<Locale, readonly ChangeLineView[]>> = {
  en: [{ kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions' }],
  ar: [{ kind: 'changed', label: 'العنوان', before: 'الأسئلة الشائعة', after: 'أسئلة' }],
};

function edit(locale: Locale, rest: Partial<EditRecordView> & Pick<EditRecordView, 'phase'>): EditRecordView {
  return {
    turnId: `edit-${rest.phase}`,
    origin: 'request',
    target: HERO[locale],
    changes: [],
    menu: [],
    ...rest,
  };
}

/** Running, on a mapped stage phrase (never the provider's narration). */
export function editRunning(locale: Locale, stage: EditStageKey = 'edit.checking'): EditRecordView {
  return edit(locale, { phase: 'running', stage });
}

/** §3.6 done: two change lines, Show on page, Undo. */
export function editDone(locale: Locale): EditRecordView {
  return edit(locale, {
    phase: 'done',
    changes: HERO_CHANGES[locale],
    elapsedMs: 16_000,
    revealNodeId: 'sec-2',
    undo: { kind: 'undo', transactionId: 'tx-edit' },
    menu: ['reuse', 'copySummary'],
  });
}

/** Five changes: the record shows three and "Show all changes (5)". */
export function editDoneMany(locale: Locale): EditRecordView {
  return { ...editDone(locale), turnId: 'edit-many', changes: MANY_CHANGES[locale] };
}

/**
 * The direct edit (engine `source: 'direct'`): a one-word title change applied at once, with
 * no model call and no stages. It is born done, and its time is under a second.
 */
export function editInstant(locale: Locale): EditRecordView {
  return edit(locale, {
    turnId: 'edit-instant',
    phase: 'done',
    target: locale === 'ar' ? 'الأسئلة الشائعة' : 'FAQ',
    changes: TITLE_CHANGE[locale],
    elapsedMs: 180,
    revealNodeId: 'sec-7',
    undo: { kind: 'undo', transactionId: 'tx-direct' },
    menu: ['reuse', 'copySummary'],
  });
}

/** Asked for what the page already had: nothing landed, nothing to undo. */
export function editNoChange(locale: Locale): EditRecordView {
  return edit(locale, { phase: 'noChange', elapsedMs: 9_000, menu: ['reuse', 'copySummary'] });
}

/** Stopped before it applied: the page wasn't changed. */
export function editStopped(locale: Locale): EditRecordView {
  return edit(locale, { phase: 'stopped', elapsedMs: 6_000, menu: ['reuse'] });
}

/** Undone: the lines stay as a record of what was taken back; Redo brings it back. */
export function editUndone(locale: Locale): EditRecordView {
  return edit(locale, {
    phase: 'undone',
    changes: HERO_CHANGES[locale],
    elapsedMs: 16_000,
    undo: { kind: 'redo', transactionId: 'tx-edit-undo' },
    menu: ['reuse', 'copySummary'],
  });
}

/** Done, read back after a reload: Undo is shown unavailable, and explained. */
export function editRevived(locale: Locale): EditRecordView {
  return { ...editDone(locale), turnId: 'edit-revived', undo: { kind: 'unavailable', why: 'revived' } };
}

/** Done, but the page moved since: Undo cannot run cleanly (`changedSince`). */
export function editChangedSince(locale: Locale): EditRecordView {
  return {
    ...editDone(locale),
    turnId: 'edit-changed-since',
    undo: { kind: 'unavailable', why: 'changedSince' },
  };
}

/** An Ask proposal that was applied (SPEC §3.8): "Applied: FAQ". */
export function editApplied(locale: Locale): EditRecordView {
  return edit(locale, {
    turnId: 'edit-applied',
    phase: 'done',
    origin: 'proposal',
    target: locale === 'ar' ? 'الأسئلة الشائعة' : 'FAQ',
    changes:
      locale === 'ar'
        ? [{ kind: 'changed', label: 'العنوان', before: 'الأسئلة الشائعة', after: 'أسئلة يطرحها المرضى' }]
        : [{ kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' }],
    elapsedMs: 18_000,
    revealNodeId: 'sec-7',
    undo: { kind: 'undo', transactionId: 'tx-applied' },
    menu: ['reuse', 'copySummary'],
  });
}

/** A page-wide edit: no target, so the titles name the page. */
export function editPageWide(locale: Locale, phase: 'running' | 'done' = 'done'): EditRecordView {
  const base = phase === 'running' ? editRunning(locale, 'edit.writing') : editDone(locale);
  const { target: _target, ...rest } = base;
  return {
    ...rest,
    turnId: `edit-page-${phase}`,
    ...(phase === 'done'
      ? {
          changes:
            locale === 'ar'
              ? [{ kind: 'changed' as const, label: 'اتجاه الصفحة', before: 'من اليسار إلى اليمين', after: 'من اليمين إلى اليسار' }]
              : [{ kind: 'changed' as const, label: 'Page direction', before: 'Left to right', after: 'Right to left' }],
        }
      : {}),
  };
}

/** Landed, and no line reads it: the record says so, and keeps its Undo. */
export function editUnlisted(locale: Locale): EditRecordView {
  return edit(locale, {
    turnId: 'edit-unlisted',
    phase: 'done',
    unlisted: true,
    elapsedMs: 12_000,
    undo: { kind: 'undo', transactionId: 'tx-unlisted' },
    menu: ['reuse', 'copySummary'],
  });
}

/* ── Errors (SPEC §4.14) ──────────────────────────────────────────────────── */

/** Every failure class, in SPEC §4.14's order. */
export const ERROR_CLASSES = [
  'unreachable',
  'timeout',
  'busy',
  'declined',
  'invalid',
  'tooLarge',
  'offline',
  'unknown',
] as const satisfies readonly ErrorClass[];

const RETRYABLE: Readonly<Record<ErrorClass, boolean>> = {
  unreachable: true,
  timeout: true,
  busy: true,
  declined: false,
  invalid: true,
  tooLarge: true,
  offline: true,
  unknown: true,
};

/** An error record of `failure`, leaving the page as `pageState` says. */
export function errorView(
  failure: ErrorClass,
  pageState: ErrorPageState = { kind: 'unchanged' },
): ErrorView {
  return {
    turnId: `error-${failure}-${pageState.kind}`,
    failure,
    pageState,
    retryable: RETRYABLE[failure],
    // Technical text: the clipboard's, never the screen's (SPEC §4.14).
    details: `remote/${failure}: fill-3 exceeded 45000ms; setProp craftkit.hero ~11.2k tokens`,
    menu: ['reuse', 'copyError'],
  };
}

/* ── Answers and endings (SPEC §4.10) ─────────────────────────────────────── */

const SHORT_ANSWER: Readonly<Record<Locale, string>> = {
  en: 'The pricing section shows three plans. The middle one is highlighted in the site colour.',
  ar: 'قسم الأسعار يعرض ثلاث باقات، والباقة الوسطى مميّزة بلون الموقع.',
};

const LONG_ANSWER: Readonly<Record<Locale, string>> = {
  en: [
    'Your page has eight sections, from the header down to the contact form.',
    'The hero promises a new smile and books through WhatsApp; the button sits under the phone number, so it is the first thing a patient reaches.',
    'Services lists implants, braces and whitening with a price for each, and the doctors section introduces Dr. Lina Haddad and two colleagues.',
    'Testimonials quote three patients. Their names and the rating are samples: replace them before you publish.',
    'The FAQ answers six questions about insurance, parking and first visits.',
    'The contact section has a map, the opening hours and a second booking button.',
  ].join('\n'),
  ar: [
    'في صفحتك ثمانية أقسام، من الترويسة حتى نموذج التواصل.',
    'الواجهة تعد بابتسامة جديدة والحجز فيها عبر واتساب، والزر تحت رقم الهاتف مباشرة حتى يكون أول ما يصل إليه المريض.',
    'قسم الخدمات يعرض زراعة الأسنان والتقويم والتبييض مع سعر لكل خدمة، وقسم الأطباء يعرّف بالدكتورة لينا حداد وزميلين لها.',
    'آراء المرضى تقتبس ثلاثة مرضى، وأسماؤهم والتقييم أمثلة يجب استبدالها قبل النشر.',
    'الأسئلة الشائعة تجيب عن ستة أسئلة حول التأمين والمواقف والزيارة الأولى.',
    'وفي قسم التواصل خريطة وساعات الدوام وزر حجز ثانٍ.',
  ].join('\n'),
};

/** A short answer, in a question's own language. */
export function answerShort(locale: Locale): AnswerView {
  return { turnId: 'answer-short', text: SHORT_ANSWER[locale], menu: ['copyAnswer'] };
}

/** An answer longer than six lines: it opens folded, with "Show more". */
export function answerLong(locale: Locale): AnswerView {
  return { turnId: 'answer-long', text: LONG_ANSWER[locale], menu: ['copyAnswer'] };
}

/** Every ending, in `EndNoteKey`'s order. */
export const END_NOTE_KEYS = [
  'proposalDiscarded',
  'planDiscarded',
  'planSuperseded',
  'stoppedBeforeChange',
  'interrupted',
  'siteAsOnePage',
  'newPageAppended',
  'appendedNotReplaced',
] as const satisfies readonly EndNoteKey[];

export function endNote(key: EndNoteKey): EndNoteView {
  return { turnId: `end-${key}`, key };
}

/* ── The person's messages (SPEC §4.5) ────────────────────────────────────── */

const REQUEST: Readonly<Record<Locale, string>> = {
  en: 'A dental clinic page in Amman, WhatsApp booking',
  ar: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
};

/** A whole-page request: the scope chip is the default, so the bubble shows no context line. */
export function messagePlain(locale: Locale): UserMessageView {
  return {
    turnId: 'message-plain',
    text: REQUEST[locale],
    chips: [{ kind: 'page', id: 'page' }],
    notRun: false,
  };
}

/** §3.6: sent with the hero selected; the chip forms the bubble's first line. */
export function messageWithContext(locale: Locale): UserMessageView {
  return {
    turnId: 'message-context',
    text:
      locale === 'ar'
        ? 'اجعل الواجهة داكنة وأضف زر واتساب'
        : 'Make the hero dark and add a WhatsApp button',
    chips: [
      { kind: 'selection', id: 'sec-2', label: HERO[locale], stale: false },
      {
        kind: 'mention',
        id: 'sec-3',
        label: locale === 'ar' ? 'الخدمات' : 'Services',
        stale: false,
      },
    ],
    notRun: false,
  };
}

/**
 * Mixed scripts: four Latin letters, then Arabic. `dir="auto"` would lay it out left to
 * right; the majority of letters says right to left (SPEC §4.5, §6.6).
 */
export function messageMixed(): UserMessageView {
  return {
    turnId: 'message-mixed',
    text: 'Hero قسم الخدمات يحتاج صورة أوضح\nوالعنوان أقصر',
    chips: [],
    notRun: false,
  };
}

/** Stopped before any output: the request was never run. */
export function messageNotRun(locale: Locale): UserMessageView {
  return { ...messagePlain(locale), turnId: 'message-not-run', notRun: true };
}

/** Sent with a block that is no longer on the page. */
export function messageStaleChip(locale: Locale): UserMessageView {
  return {
    turnId: 'message-stale',
    text: locale === 'ar' ? 'أعد صياغة هذا القسم' : 'Rewrite this section',
    chips: [
      {
        kind: 'selection',
        id: 'gone',
        label: locale === 'ar' ? 'آراء المرضى' : 'Testimonials',
        stale: true,
      },
    ],
    notRun: false,
  };
}

/** A long unbroken link: the bubble wraps it instead of scrolling sideways. */
export function messageLongLink(): UserMessageView {
  return {
    turnId: 'message-link',
    text: 'Use the photos from https://images.example.com/clinics/amman/dental-smile-studio/gallery/2026/hero-wide-original.jpg',
    chips: [],
    notRun: false,
  };
}
