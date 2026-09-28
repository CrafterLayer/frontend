import {
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  contrastRatio,
  defaultDesignSystem,
  validateDesignSystem,
  validatePagePlan,
  type PagePlan,
  type PagePlanCandidate,
  type PagePlanIssue,
  type PagePlanTokens,
  type PagePlanValidationResult,
  type SectionContract,
} from '@craftkit/builder';

import type {
  FontPairOption,
  PlanDirectionView,
  PlanOp,
  PlanProblem,
  PlanSectionView,
  PlanView,
  SwatchRole,
  SwatchView,
} from './view-types';

/**
 * The editable page plan (SPEC §3.7, §4.11 PagePlanCard): its ops, its limits and whether
 * it may be built.
 *
 * Pure and total. `applyPlanOp` returns the SAME draft for an op it refuses (an empty
 * name, a move to where the row already is, a remove at two sections), so a caller tells
 * "nothing changed" from "changed" by identity, and a refused op never costs a render or
 * an "Edited" tag. Nothing here throws, and no op mutates its input.
 *
 * Since the engine takes a structured plan (SPEC §7.6 E6: `PagePlan`, `validatePagePlan`,
 * `runAiBuild({ pagePlan })`), a draft can carry the engine's plan it was made from
 * (`draftFromEnginePagePlan`), and `toEnginePagePlan` hands the edited plan back through
 * the engine's own validator, so what Build sends is what the card shows. On such a draft
 * an op the validator would refuse for its SHAPE (a header moved down, the hero removed, a
 * title too long for the page) is refused here, the same way as an empty name: a card
 * that let it through would disable Build with no way to say why. An unreadable colour is
 * let through and named (`contrast`), because the person fixes it on the same card.
 */

/**
 * The fewest sections a plan may hold: the engine's own `PAGE_PLAN_MIN_SECTIONS`, which
 * `validatePagePlan` enforces. Below two regions `runAiBuild` does not build at all; it
 * emits `build.skipped` and runs one ordinary call, so a one-section "plan" would promise a
 * build the engine never runs.
 */
export const PLAN_MIN_SECTIONS: number = PAGE_PLAN_MIN_SECTIONS;

/**
 * The most sections a plan may hold: the engine's own `PAGE_PLAN_MAX_SECTIONS` (12), which
 * the engine pins equal to its `maxTasks` default so every planned section can be written.
 */
export const PLAN_MAX_SECTIONS: number = PAGE_PLAN_MAX_SECTIONS;

/** The five direction roles, in display order (SPEC §4.8 DirectionLine, §4.11 `role.*`). */
export const SWATCH_ROLES = [
  'background',
  'surface',
  'text',
  'accent',
  'onAccent',
] as const satisfies readonly SwatchRole[];

/**
 * Curated Arabic-capable font pairs for FontPairMenu (SPEC §4.11), heading face first.
 *
 * Every face is one of the engine's verified families (`verified-fonts.ts`: fetched from
 * both font hosts with Arabic unicode ranges and rendered in Chromium, 2026-09-28), and
 * the engine is the judge: `page-plan-draft.test.ts` runs every pair through the engine's
 * own `validatePagePlan` on an Arabic page and on an English one. The list is not read
 * from the engine because it does not export it (`VERIFIED_FONT_FAMILIES` is internal to
 * `@craftkit/builder-ai`). Not "any Google font": every recorded skeleton used Cairo
 * because the skills offered four faces, and a menu of everything is a menu nobody reads.
 */
export const FONT_PAIRS: readonly FontPairOption[] = [
  { id: 'reem-kufi--ibm-plex-sans-arabic', heading: 'Reem Kufi', body: 'IBM Plex Sans Arabic' },
  { id: 'el-messiri--almarai', heading: 'El Messiri', body: 'Almarai' },
  { id: 'readex-pro--ibm-plex-sans-arabic', heading: 'Readex Pro', body: 'IBM Plex Sans Arabic' },
  {
    id: 'noto-kufi-arabic--noto-sans-arabic',
    heading: 'Noto Kufi Arabic',
    body: 'Noto Sans Arabic',
  },
  { id: 'changa--cairo', heading: 'Changa', body: 'Cairo' },
  { id: 'lalezar--almarai', heading: 'Lalezar', body: 'Almarai' },
  { id: 'lemonada--tajawal', heading: 'Lemonada', body: 'Tajawal' },
  { id: 'el-messiri--noto-naskh-arabic', heading: 'El Messiri', body: 'Noto Naskh Arabic' },
  { id: 'amiri--markazi-text', heading: 'Amiri', body: 'Markazi Text' },
  { id: 'aref-ruqaa--almarai', heading: 'Aref Ruqaa', body: 'Almarai' },
  { id: 'ibm-plex-sans-arabic', heading: 'IBM Plex Sans Arabic', body: 'IBM Plex Sans Arabic' },
];

export function fontPairById(id: string): FontPairOption | undefined {
  return FONT_PAIRS.find((pair) => pair.id === id);
}

/** The pair as DirectionLine shows it: "Reem Kufi / IBM Plex Sans Arabic", one name for one family. */
export function fontsLabel(pair: Pick<FontPairOption, 'heading' | 'body'>): string {
  return pair.heading === pair.body ? pair.heading : `${pair.heading} / ${pair.body}`;
}

/**
 * A page plan as the person edits it. `direction` is absent when the plan carries none.
 * `engine` is the engine's validated plan the draft was made from, never edited itself:
 * a section's role, anchor, claims and pictures, the nav, the CTA and the facts ledger
 * all live there, keyed by the same section keys the rows carry.
 */
export interface PagePlanDraft {
  readonly subject: string;
  readonly sections: readonly PlanSectionView[];
  readonly direction?: PlanDirectionView | undefined;
  readonly engine?: PagePlan | undefined;
}

export interface PlanDraftInput {
  readonly subject: string;
  /** Titles, or sections with the keys and purposes the engine already gave. */
  readonly sections: readonly (
    | string
    | {
        readonly title: string;
        readonly purpose?: string | undefined;
        readonly key?: string | undefined;
      }
  )[];
  /**
   * The engine's direction prose (today's `onPlanned` hands a string, SPEC §7.6 E7), or a
   * structured direction once plans carry tokens and fonts.
   */
  readonly direction?:
    | string
    | {
        readonly mood: string;
        readonly swatches?: readonly SwatchView[] | undefined;
        readonly fontPairId?: string | undefined;
      }
    | undefined;
}

/** One line of prose, as a person meant it: runs of whitespace collapsed, ends trimmed. */
function tidy(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * `#rgb` or `#rrggbb`, lowercased to `#rrggbb`. An alpha channel is refused: contrast is
 * measured without it, so a translucent colour's verdict would be a number about a
 * backdrop nobody chose.
 */
function normaliseHex(hex: string): string | undefined {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(hex.trim());
  const digits = match?.[1]?.toLowerCase();
  if (digits === undefined) return undefined;
  // Hex digits are ASCII, so doubling each character is safe here.
  return digits.length === 3 ? `#${digits.replace(/./gu, '$&$&')}` : `#${digits}`;
}

/** Swatches with valid colours, one per role, in display order. */
function orderedSwatches(swatches: readonly SwatchView[]): readonly SwatchView[] {
  const byRole = new Map<SwatchRole, string>();
  for (const swatch of swatches) {
    const hex = normaliseHex(swatch.hex);
    if (hex !== undefined) byRole.set(swatch.role, hex);
  }
  return SWATCH_ROLES.flatMap((role) => {
    const hex = byRole.get(role);
    return hex === undefined ? [] : [{ role, hex }];
  });
}

/*
  A key no section has, and one a removed-then-added row does not share with any row still
  on the list: `section-N` one past the highest in use, so React never mistakes a new row
  for a surviving one.
*/
function freshKey(taken: Iterable<string>): string {
  let highest = 0;
  for (const key of taken) {
    const match = /^section-(\d+)$/u.exec(key);
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]));
  }
  return `section-${String(highest + 1)}`;
}

function directionFrom(input: PlanDraftInput['direction']): PlanDirectionView | undefined {
  if (input === undefined) return undefined;
  if (typeof input === 'string') return { mood: tidy(input) };
  const pair = input.fontPairId === undefined ? undefined : fontPairById(input.fontPairId);
  return {
    mood: tidy(input.mood),
    ...(input.swatches === undefined ? {} : { swatches: orderedSwatches(input.swatches) }),
    ...(pair === undefined ? {} : { fontPairId: pair.id, fonts: fontsLabel(pair) }),
  };
}

/**
 * A draft from the engine's plan: every section keyed (keeping the keys it gave), titles
 * tidied, page order kept. A plan over the limit or with a repeated title arrives as it
 * is, and `planProblems` says what stands in the way.
 *
 * The one row dropped is a section with no title, because the engine drops it too: its
 * `nodeTitle` reads a blank label as none (`run-build.ts`), so that region is never a
 * task and never written. A nameless row would be a section the card promises and the
 * build skips. Rename and add refuse a blank title for the same reason.
 */
export function createPlanDraft(input: PlanDraftInput): PagePlanDraft {
  const entries = input.sections
    .map((section) => (typeof section === 'string' ? { title: section } : section))
    .filter((entry) => tidy(entry.title) !== '');
  const taken = new Set<string>();
  for (const entry of entries) {
    if ('key' in entry && entry.key !== undefined) taken.add(entry.key);
  }
  const sections = entries.map((entry): PlanSectionView => {
    let key = 'key' in entry ? entry.key : undefined;
    if (key === undefined) {
      key = freshKey(taken);
      taken.add(key);
    }
    const purpose = 'purpose' in entry && entry.purpose !== undefined ? tidy(entry.purpose) : '';
    return { key, title: tidy(entry.title), ...(purpose === '' ? {} : { purpose }) };
  });
  const direction = directionFrom(input.direction);
  return {
    subject: tidy(input.subject),
    sections,
    ...(direction === undefined ? {} : { direction }),
  };
}

/** Whether a section may be removed: not below the engine's two (SPEC §4.11 `plan.min`). */
export function canRemoveSection(draft: PagePlanDraft): boolean {
  return draft.sections.length > PLAN_MIN_SECTIONS;
}

/** Whether a section may be added: not past the engine's twelve (SPEC §4.11 `plan.max`). */
export function canAddSection(draft: PagePlanDraft): boolean {
  return draft.sections.length < PLAN_MAX_SECTIONS;
}

/**
 * The op for Alt+↑ / Alt+↓ or ⋯ → Move up / Move down on one row, or `null` at the edge,
 * so the key does nothing there and the menu item can be disabled from the same answer.
 */
export function moveOp(draft: PagePlanDraft, key: string, delta: -1 | 1): PlanOp | null {
  const index = draft.sections.findIndex((section) => section.key === key);
  const to = index + delta;
  if (index < 0 || to < 0 || to >= draft.sections.length) return null;
  return { kind: 'move', key, to };
}

function withDirection(draft: PagePlanDraft, direction: PlanDirectionView): PagePlanDraft {
  return { ...draft, direction };
}

/** One edit to the draft; the same draft back when the op is refused (see the module note). */
export function applyPlanOp(draft: PagePlanDraft, op: PlanOp): PagePlanDraft {
  const next = editedDraft(draft, op);
  if (next === draft || draft.engine === undefined) return next;
  /*
    The engine's validator is the judge of a structured plan's shape, not a copy of its
    rules here: an op is refused when it brings an issue the draft did not have, other
    than contrast (the card names that one, and the person fixes it in place).
  */
  const had = new Set(shapeIssues(draft).map(issueKey));
  return shapeIssues(next).some((issue) => !had.has(issueKey(issue))) ? draft : next;
}

function editedDraft(draft: PagePlanDraft, op: PlanOp): PagePlanDraft {
  const { sections, direction } = draft;
  switch (op.kind) {
    case 'rename': {
      const index = sections.findIndex((section) => section.key === op.key);
      const current = sections[index];
      const title = tidy(op.title);
      if (current === undefined || title === '' || title === current.title) return draft;
      return {
        ...draft,
        sections: sections.map((section, at) => (at === index ? { ...section, title } : section)),
      };
    }
    case 'move': {
      const index = sections.findIndex((section) => section.key === op.key);
      const moving = sections[index];
      // A non-finite index is no index: clamping NaN read as 0 and sent the row to the top.
      if (moving === undefined || !Number.isFinite(op.to)) return draft;
      // A drop past either end lands at that end; a fractional index is a drag's rounding.
      const to = Math.min(Math.max(Math.trunc(op.to), 0), sections.length - 1);
      if (to === index) return draft;
      const rest = sections.filter((_section, at) => at !== index);
      return { ...draft, sections: [...rest.slice(0, to), moving, ...rest.slice(to)] };
    }
    case 'remove': {
      if (!canRemoveSection(draft) || !sections.some((section) => section.key === op.key)) {
        return draft;
      }
      return { ...draft, sections: sections.filter((section) => section.key !== op.key) };
    }
    case 'add': {
      const title = tidy(op.title);
      if (title === '' || !canAddSection(draft)) return draft;
      const key = freshKey(sections.map((section) => section.key));
      // AddSectionRow sits at the end of the list; a page's footer still closes the page.
      const at =
        roleOf(draft, sections.at(-1)?.key) === 'footer' ? sections.length - 1 : sections.length;
      return {
        ...draft,
        sections: [...sections.slice(0, at), { key, title }, ...sections.slice(at)],
      };
    }
    case 'setToken': {
      const hex = normaliseHex(op.hex);
      if (direction === undefined || hex === undefined) return draft;
      const swatches = direction.swatches ?? [];
      if (swatches.some((swatch) => swatch.role === op.role && swatch.hex === hex)) return draft;
      return withDirection(draft, {
        ...direction,
        swatches: orderedSwatches([
          ...swatches.filter((swatch) => swatch.role !== op.role),
          { role: op.role, hex },
        ]),
      });
    }
    case 'setFonts': {
      const pair = fontPairById(op.pairId);
      if (direction === undefined || pair === undefined || direction.fontPairId === pair.id) {
        return draft;
      }
      return withDirection(draft, { ...direction, fontPairId: pair.id, fonts: fontsLabel(pair) });
    }
    case 'setMood': {
      const mood = tidy(op.mood);
      // An emptied field restores the mood it held (Esc-like), as the rename does.
      if (direction === undefined || mood === '' || mood === direction.mood) return draft;
      return withDirection(draft, { ...direction, mood });
    }
  }
}

/* ── Anchors ─────────────────────────────────────────────────────────────────── */

/**
 * The in-page anchor a section's title becomes (`#why-us`), so a header's nav can link to
 * it. Letters in any script are kept: an Arabic page links to `#الخدمات`, a valid id.
 * What a keyboard may or may not type is folded away, because a person reads «الأسعار»
 * and «الاسعار» as one word, and two sections that one link cannot tell apart are one
 * too many: tashkeel (U+064B to U+065F, U+0670), tatweel (U+0640), the hamza and madda
 * forms of alef, and case.
 *
 * A title with no letter or digit («🎉», «***») folds to nothing, and an empty id is no
 * anchor: then the section's KEY is its anchor. The key is stable across rename and move
 * and unique in the draft, so the anchor never shifts under a nav link and never clashes.
 */
export function sectionAnchor(title: string, key?: string): string {
  const folded = title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/gu, '')
    .replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return folded === '' && key !== undefined ? key : folded;
}

/**
 * Every row whose anchor another row shares, so each clashing row can be marked. Anchors
 * are read with each row's key, so two titles with no letters («🎉», «***») fall back to
 * two different keys and are never called one name (they once were: both folded to '',
 * and the card told the person to rename two sections already named differently).
 */
export function duplicateSectionKeys(draft: PagePlanDraft): ReadonlySet<string> {
  const byAnchor = new Map<string, string[]>();
  for (const section of draft.sections) {
    const anchor = sectionAnchor(section.title, section.key);
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), section.key]);
  }
  return new Set([...byAnchor.values()].filter((keys) => keys.length > 1).flat());
}

/* ── Contrast, through the design-system gate ─────────────────────────────────── */

/**
 * The pairs a plan's direction must keep readable, each text on what it sits on: body text
 * on the page, body text on a card, and the accent's own text on the accent (a button).
 */
const READABLE_PAIRS: readonly { readonly text: SwatchRole; readonly on: SwatchRole }[] = [
  { text: 'text', on: 'background' },
  { text: 'text', on: 'surface' },
  { text: 'onAccent', on: 'accent' },
];

/**
 * Whether `foreground` reads on `background` as normal-size text, answered by
 * `validateDesignSystem`: the same gate a site's design system passes (FR-014), with its
 * own threshold. The pair is measured as the system's text on its surface; the threshold
 * is deliberately NOT restated here (the gate's own note: a local copy once reported one
 * minimum while enforcing another).
 */
function readable(foreground: string, background: string): boolean {
  const base = defaultDesignSystem();
  const result = validateDesignSystem({
    ...base,
    tokens: { ...base.tokens, text: foreground, surface: background },
    pairings: [{ text: 'text', background: 'surface', size: 'normal' }],
  });
  return (
    result.ok ||
    !result.issues.some(
      (issue) => issue.code === 'contrast-below-minimum' || issue.code === 'contrast-unmeasurable',
    )
  );
}

function hexOf(direction: PlanDirectionView | undefined, role: SwatchRole): string | undefined {
  return direction?.swatches?.find((swatch) => swatch.role === role)?.hex;
}

/** The swatch each role is judged against in SwatchPopover, and which of the two is the text. */
const JUDGED: Readonly<
  Record<
    SwatchRole,
    { readonly text: SwatchRole; readonly on: SwatchRole; readonly against: SwatchRole }
  >
> = {
  background: { text: 'text', on: 'background', against: 'text' },
  surface: { text: 'text', on: 'surface', against: 'text' },
  text: { text: 'text', on: 'background', against: 'background' },
  accent: { text: 'onAccent', on: 'accent', against: 'onAccent' },
  onAccent: { text: 'onAccent', on: 'accent', against: 'accent' },
};

export interface SwatchContrast {
  /** The WCAG ratio, 1 to 21, for `swatch.ok` / `swatch.low` ("contrast {r}"). */
  readonly ratio: number;
  readonly readable: boolean;
  /** The role this swatch was measured against. */
  readonly against: SwatchRole;
}

/**
 * SwatchPopover's live verdict for one role (SPEC §4.11: "live contrast verdict via
 * `validateDesignSystem`"), or `null` while the pair is incomplete or a colour cannot be
 * read, which is "not measured", never "passes".
 */
export function swatchContrast(
  direction: PlanDirectionView | undefined,
  role: SwatchRole,
): SwatchContrast | null {
  const { text, on, against } = JUDGED[role];
  const foreground = hexOf(direction, text);
  const background = hexOf(direction, on);
  if (foreground === undefined || background === undefined) return null;
  const ratio = contrastRatio(foreground, background);
  if (ratio === undefined) return null;
  return { ratio, readable: readable(foreground, background), against };
}

function contrastFails(direction: PlanDirectionView | undefined): boolean {
  return READABLE_PAIRS.some(({ text, on }) => {
    const foreground = hexOf(direction, text);
    const background = hexOf(direction, on);
    // A pair the plan does not colour is not measured (SPEC §7.6 E7: prose-only direction).
    return (
      foreground !== undefined && background !== undefined && !readable(foreground, background)
    );
  });
}

/* ── Validity and edits ───────────────────────────────────────────────────────── */

/**
 * Everything that disables "Build this page", structure first: under two sections, over
 * twelve, two sections sharing an anchor, then an unreadable colour pair. Empty means the
 * plan may be built as shown.
 */
export function planProblems(draft: PagePlanDraft): readonly PlanProblem[] {
  const problems: PlanProblem[] = [];
  if (draft.sections.length < PLAN_MIN_SECTIONS) problems.push('min');
  if (draft.sections.length > PLAN_MAX_SECTIONS) problems.push('max');
  if (duplicateSectionKeys(draft).size > 0) problems.push('duplicateTitle');
  // A structured plan is measured by the engine that will build it, on every text pair.
  const contrast =
    draft.engine === undefined
      ? contrastFails(draft.direction)
      : engineIssues(draft).some(isContrastIssue);
  if (contrast) problems.push('contrast');
  return problems;
}

/* ── The engine's structured plan (SPEC §7.6 E6, E7) ──────────────────────────────── */

/** The swatch roles and the plan tokens they edit; the other tokens are derived. */
const TOKEN_OF_ROLE: Readonly<
  Record<SwatchRole, 'bg' | 'surface' | 'ink' | 'accent' | 'onAccent'>
> = {
  background: 'bg',
  surface: 'surface',
  text: 'ink',
  accent: 'accent',
  onAccent: 'onAccent',
};

function roleOf(
  draft: PagePlanDraft,
  key: string | undefined,
): SectionContract['role'] | undefined {
  return draft.engine?.sections.find((section) => section.key === key)?.role;
}

/**
 * The direction line and editor for a plan's tokens: its signature as the mood, the five
 * swatches a person edits, and the two faces by name (and by curated pair when they are
 * one). `muted`, `accentInk` and `border` are not on the card: they follow the five.
 */
function directionOfTokens(tokens: PagePlanTokens): PlanDirectionView {
  const heading = tokens.fontDisplay.family;
  const body = tokens.fontBody.family;
  const pair = FONT_PAIRS.find((option) => option.heading === heading && option.body === body);
  return {
    mood: tidy(tokens.signature),
    swatches: SWATCH_ROLES.map((role) => ({ role, hex: tokens[TOKEN_OF_ROLE[role]] })),
    fonts: fontsLabel({ heading, body }),
    ...(pair === undefined ? {} : { fontPairId: pair.id }),
  };
}

/**
 * A draft of the engine's plan (Plan mode's `planAiPage` answer, or Ask's `onPlanned`
 * plan): the rows by the plan's own keys, its title as the subject, its tokens as the
 * direction. `toEnginePagePlan` of the untouched draft gives this plan back, equal.
 */
export function draftFromEnginePagePlan(plan: PagePlan): PagePlanDraft {
  return {
    subject: tidy(plan.title),
    sections: plan.sections.map((section) => ({
      key: section.key,
      title: section.title,
      purpose: section.purpose,
    })),
    direction: directionOfTokens(plan.tokens),
    engine: plan,
  };
}

/**
 * The draft a stored page-plan turn holds: the person's rows and direction over the
 * engine's plan they were drawn from (`PagePlanTurn.enginePlan`). Without an engine plan
 * it is the titles-only draft of the read-only fallback.
 */
export function planDraftOf(turn: {
  readonly subject: string;
  readonly sections: readonly PlanSectionView[];
  readonly direction?: PlanDirectionView | undefined;
  readonly enginePlan?: PagePlan | undefined;
}): PagePlanDraft {
  return {
    subject: turn.subject,
    sections: turn.sections,
    ...(turn.direction === undefined ? {} : { direction: turn.direction }),
    ...(turn.enginePlan === undefined ? {} : { engine: turn.enginePlan }),
  };
}

/*
  WCAG AA for body text, as the engine holds every text pair of a plan to it. Used only to
  decide whether a DERIVED token still reads after the person moved a colour it sits on;
  the verdict on the plan itself is always the engine validator's.
*/
const AA_BODY_TEXT = 4.5;

function readsOn(foreground: string, ground: string): boolean {
  return (contrastRatio(foreground, ground) ?? 0) >= AA_BODY_TEXT;
}

/*
  The tokens a candidate carries after the card's edits. The five swatches are the
  person's; the three derived ones follow them honestly: `muted` is kept while it still
  reads on both grounds, else it becomes the ink (a secondary line in the ink colour is
  less subtle and still readable); `accentInk` is dropped when it was derived (it equals
  the old accent or the old ink) or no longer reads, and the engine derives it again.
*/
function candidateTokens(
  base: PagePlanTokens,
  direction: PlanDirectionView | undefined,
): Readonly<Record<string, unknown>> {
  const colour = (role: SwatchRole): string => hexOf(direction, role) ?? base[TOKEN_OF_ROLE[role]];
  const bg = colour('background');
  const surface = colour('surface');
  const ink = colour('text');
  const muted = readsOn(base.muted, bg) && readsOn(base.muted, surface) ? base.muted : ink;
  const derived = base.accentInk === base.accent || base.accentInk === base.ink;
  const keepAccentInk = !derived && readsOn(base.accentInk, bg) && readsOn(base.accentInk, surface);
  const pair = direction?.fontPairId === undefined ? undefined : fontPairById(direction.fontPairId);
  const face = (was: PagePlanTokens['fontDisplay'], family: string | undefined) => ({
    family: family ?? was.family,
    weights: was.weights,
  });
  return {
    bg,
    surface,
    ink,
    muted,
    accent: colour('accent'),
    onAccent: colour('onAccent'),
    ...(keepAccentInk ? { accentInk: base.accentInk } : {}),
    border: base.border,
    fontDisplay: face(base.fontDisplay, pair?.heading),
    fontBody: face(base.fontBody, pair?.body),
    radius: base.radius,
    signature: direction?.mood ?? base.signature,
    ...(base.deckRowId === undefined ? {} : { deckRowId: base.deckRowId }),
  };
}

/**
 * The plan a candidate's sections make: each row's contract with the person's title (and
 * purpose), in the draft's order; a row the person added is a band, keyed and anchored by
 * its stable key (an anchor is a Latin slug even on an Arabic page), whose purpose is the
 * name they gave it. The nav, the facts and the CTA follow: a link to a removed section
 * goes, a fact shown only there goes, a CTA that pointed there points at the section that
 * took its place; a nav label that was the old title follows a rename.
 */
function candidateOf(
  draft: PagePlanDraft,
  base: PagePlan,
  followLabels: boolean,
): PagePlanCandidate {
  const contracts = new Map(base.sections.map((section) => [section.key, section]));
  const sections = draft.sections.map((row) => {
    const contract = contracts.get(row.key);
    if (contract !== undefined) {
      return { ...contract, title: row.title, purpose: row.purpose ?? contract.purpose };
    }
    return {
      key: row.key,
      role: 'band',
      title: row.title,
      anchorId: row.key,
      purpose: row.purpose ?? row.title,
      mustSay: [],
      mustNotRepeat: [],
    };
  });
  const anchors = new Set(sections.map((section) => section.anchorId));
  const keys = new Set(sections.map((section) => section.key));
  const titleAt = new Map(sections.map((section) => [section.anchorId, section.title]));
  const wasTitleAt = new Map(base.sections.map((section) => [section.anchorId, section.title]));

  const nav = base.nav
    .filter((item) => anchors.has(item.anchorId))
    .map((item) =>
      followLabels && item.label === wasTitleAt.get(item.anchorId)
        ? { ...item, label: titleAt.get(item.anchorId) ?? item.label }
        : item,
    );

  let primaryCta = base.primaryCta;
  const target = base.primaryCta.href.startsWith('#') ? base.primaryCta.href.slice(1) : null;
  if (target !== null && !anchors.has(target)) {
    // The section that took the removed one's place, or the last one when it was last.
    const was = base.sections.findIndex((section) => section.anchorId === target);
    const heir =
      base.sections.slice(was + 1).find((section) => anchors.has(section.anchorId)) ??
      sections.at(-1);
    if (heir !== undefined) primaryCta = { ...base.primaryCta, href: `#${heir.anchorId}` };
  }

  return {
    intent: base.intent,
    locale: base.locale,
    title: base.title,
    description: base.description,
    tokens: candidateTokens(base.tokens, draft.direction),
    primaryCta,
    nav,
    sections,
    facts: base.facts.filter((fact) => keys.has(fact.section)),
  };
}

/* A new pair's faces may not ship the old weights; the engine then picks its defaults. */
const isWeightIssue = (issue: PagePlanIssue): boolean =>
  /^tokens\.font(?:Display|Body)\.weights\b/u.test(issue.path);

/* A nav label that followed a rename may no longer fit; it keeps its old words. */
const isNavLabelIssue = (issue: PagePlanIssue): boolean => /^nav\[\d+\]\.label$/u.test(issue.path);

/* The faces a weight was refused for, named by family alone: the engine then picks its own. */
function withBareFaces(
  candidate: PagePlanCandidate,
  issues: readonly PagePlanIssue[],
): PagePlanCandidate {
  const tokens = candidate['tokens'] as Readonly<Record<string, { readonly family?: unknown }>>;
  const bare = (slot: 'fontDisplay' | 'fontBody') =>
    issues.some((issue) => issue.path.startsWith(`tokens.${slot}.weights`))
      ? { [slot]: { family: tokens[slot]?.family } }
      : {};
  return { ...candidate, tokens: { ...tokens, ...bare('fontDisplay'), ...bare('fontBody') } };
}

/**
 * The edited draft as the plan the engine builds, validated by the engine's own
 * `validatePagePlan` and held to the intent it was shown under (SPEC §7.6 E6: "Build
 * consumes it verbatim"). `ok` carries the `PagePlan` to hand to `runAiBuild({ pagePlan })`
 * or to answer `onPlanned` with `{ build: plan }`. `undefined` for a draft that carries no
 * engine plan (the read-only fallback, a v1 outline).
 */
export function toEnginePagePlan(draft: PagePlanDraft): PagePlanValidationResult | undefined {
  const base = draft.engine;
  if (base === undefined) return undefined;
  const judge = (followLabels: boolean): PagePlanValidationResult => {
    const candidate = candidateOf(draft, base, followLabels);
    const result = validatePagePlan(candidate, { intent: base.intent });
    return !result.ok && result.issues.some(isWeightIssue)
      ? validatePagePlan(withBareFaces(candidate, result.issues), { intent: base.intent })
      : result;
  };
  const followed = judge(true);
  return !followed.ok && followed.issues.some(isNavLabelIssue) ? judge(false) : followed;
}

/* Every issue the engine finds in the draft's plan; none for a draft with no engine plan. */
function engineIssues(draft: PagePlanDraft): readonly PagePlanIssue[] {
  const result = toEnginePagePlan(draft);
  return result === undefined || result.ok ? [] : result.issues;
}

/** The engine's contrast refusals: one per text pair, each at `tokens.<foreground>`. */
function isContrastIssue(issue: PagePlanIssue): boolean {
  return /^tokens\.(?:ink|muted|onAccent|accentInk)$/u.test(issue.path);
}

/* The issues that are not contrast: a shape the card must never let an op create. */
function shapeIssues(draft: PagePlanDraft): readonly PagePlanIssue[] {
  return engineIssues(draft).filter((issue) => !isContrastIssue(issue));
}

const issueKey = (issue: PagePlanIssue): string => `${issue.path} ${issue.message}`;

/* What the build reads from a plan, in a form two drafts can be compared by. */
function buildable(draft: PagePlanDraft): string {
  const direction = draft.direction;
  return JSON.stringify({
    sections: draft.sections.map(({ title, purpose }) => [title, purpose ?? '']),
    direction:
      direction === undefined
        ? null
        : [
            direction.mood,
            direction.fontPairId ?? '',
            (direction.swatches ?? []).map(({ role, hex }) => `${role}:${hex}`),
          ],
  });
}

/**
 * Whether the person changed what would be built (the card's "Edited" tag, SPEC §4.11).
 * By content, not by keys or history: a rename undone by hand, or a section removed and
 * added back where it was, is the plan as proposed again.
 */
export function isEdited(original: PagePlanDraft, draft: PagePlanDraft): boolean {
  return original !== draft && buildable(original) !== buildable(draft);
}

/** The PlanView fields this module owns; the controller adds turn id, status, mode and note. */
export function planFields(
  original: PagePlanDraft,
  draft: PagePlanDraft,
): Pick<PlanView, 'subject' | 'direction' | 'sections' | 'edited' | 'problems'> {
  return {
    subject: draft.subject,
    direction: draft.direction,
    sections: draft.sections,
    edited: isEdited(original, draft),
    problems: planProblems(draft),
  };
}
