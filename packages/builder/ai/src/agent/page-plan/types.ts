import type { JsonValue } from '@craftkit/builder-schema';

import type { PhotoOrientation, PhotoTopic } from '../../context/providers/photo-catalog.data';
import type { IntentTarget } from '../../intent';
import type { PagePlanCandidate, PagePlanIssue } from '../../types';

export type { PagePlanCandidate, PagePlanIssue };

/**
 * The PAGE PLAN: one structured, editable design of a whole page, decided once
 * (step T1, agent-audit §3.1–3.2, 2026-09-28).
 *
 * ## The gap it closes
 *
 * Before it, the plan a person approved was ~60 words of prose (the scaffold's
 * rationale) and "Build" re-planned from scratch, so the list shown was not the
 * list built (P1-7b). Colours and fonts reached section writers only as that
 * prose (P1-10), and a recipe's `text-{accent}` became yellow-400 on white —
 * 1.53:1, measured by the wave-1 verifier on the construction deck row.
 *
 * Now the plan is DATA: Plan mode shows it, Ask approves it, Build consumes it
 * verbatim. The skeleton, the token CSS and the font import are written from it
 * by code (`skeletonFromPlan`), each writer gets its own `SectionContract`, and
 * the checker (`checkSection`) holds each landed section to it.
 *
 * Every value here has passed `validatePagePlan`: colours are `#rrggbb`
 * (lower-case), every text pair clears WCAG AA, fonts are verified faces with
 * weights they ship, keys and anchors are unique slugs, and every link and fact
 * points at a section that exists. Nothing else constructs one.
 */
export interface PagePlan {
  /**
   * Where the page lands: a new page beside the current one, replacing the
   * current page's content, or appended below it. The host's router decides
   * (`IntentRoute.target`); `validatePagePlan({ intent })` enforces it.
   */
  readonly intent: PagePlanIntent;
  readonly locale: PagePlanLocale;
  /** The document title (`setDocMeta`), in the page's language. */
  readonly title: string;
  /** The meta description, in the page's language. */
  readonly description: string;
  readonly tokens: PagePlanTokens;
  /** THE action of the page. The checker holds every CTA button to this exact label. */
  readonly primaryCta: PagePlanLink;
  /** The header's links, in order; each names a section's `anchorId`. May be empty. */
  readonly nav: readonly PagePlanNavItem[];
  /** In page order, `PAGE_PLAN_MIN_SECTIONS`..`PAGE_PLAN_MAX_SECTIONS` of them. */
  readonly sections: readonly SectionContract[];
  /**
   * The facts ledger: every sample fact the plan invented (a phone number, a
   * price, an address) that the OWNER must replace before publishing. Shown on
   * the Built card (P1-13) — invented facts were never surfaced before.
   */
  readonly facts: readonly PagePlanFact[];
}

/** Same three values as the intent router's target, by construction. */
export type PagePlanIntent = IntentTarget;
export const PAGE_PLAN_INTENTS = [
  'new-page',
  'replace',
  'append',
] as const satisfies readonly PagePlanIntent[];

export interface PagePlanLocale {
  /** BCP 47, lower-case primary subtag: `ar`, `en`, `ar-jo`. */
  readonly lang: string;
  /** Derived from `lang` when the language's direction is known (Arabic is always `rtl`). */
  readonly dir: 'rtl' | 'ltr';
}

/**
 * The page's design tokens. The skeleton writes them as CSS custom properties
 * on the page (`--ck-bg`, `--ck-surface`, …) and writers colour with those.
 *
 * Every colour is `#rrggbb`. A candidate may name a Tailwind palette shade
 * (`orange-700`, `white`) — the deck is written in them — and it is resolved to
 * the Tailwind v3 hex the deck's contrast was computed on.
 *
 * Contrast (all ≥ 4.5:1, WCAG 2.2 AA for body text):
 *   ink/bg, ink/surface, muted/bg, muted/surface, onAccent/accent,
 *   accentInk/bg, accentInk/surface.
 * `border` is decorative and not measured.
 */
export interface PagePlanTokens {
  /** The page ground. */
  readonly bg: string;
  /** Cards and raised panels on the ground. */
  readonly surface: string;
  /** Headings and body text. */
  readonly ink: string;
  /** Secondary text: leads, captions, meta. */
  readonly muted: string;
  /** The brand fill: buttons, highlights, the band. */
  readonly accent: string;
  /** Text and icons ON an accent fill. */
  readonly onAccent: string;
  /**
   * Accent-coloured TEXT on the ground and on cards: stat numbers, step
   * numbers, eyebrow labels, icons. Exists because the accent FILL is often
   * unreadable as text — yellow-400 on white is 1.53:1 — and the recipes wrote
   * `text-{accent}` with nothing else to reach for.
   *
   * When a candidate omits it: the accent itself if it reads on both grounds,
   * else `ink`.
   */
  readonly accentInk: string;
  /** Hairlines and dividers. */
  readonly border: string;
  /** Headings. A verified face (`VERIFIED_FONT_FAMILIES`); Arabic-capable on an Arabic page. */
  readonly fontDisplay: PagePlanFont;
  /** Body text. Same rules as `fontDisplay`. */
  readonly fontBody: PagePlanFont;
  readonly radius: PagePlanRadius;
  /** The ONE memorable move of this page, in a sentence (from the deck row, or the model's own). */
  readonly signature: string;
  /** The direction-deck row this look started from (`DIRECTION_DECK_ROWS[].id`), when one did. */
  readonly deckRowId?: string;
}

export interface PagePlanFont {
  /** The verified family name, exactly as `VERIFIED_FONT_FAMILIES` spells it. */
  readonly family: string;
  /** Weights to import, ascending, every one shipped by the family. Never empty. */
  readonly weights: readonly number[];
  /**
   * The css2 import URL, always BUILT from family + weights by
   * `directionDeckImportUrl` — a candidate's own URL is ignored, because one
   * wrong weight in a css2 request drops every face in it (measured
   * 2026-09-28: `Lalezar:wght@700` answers 400). A one-weight face imports bare.
   */
  readonly url: string;
}

export const PAGE_PLAN_RADII = ['none', 'md', 'xl', 'full'] as const;
export type PagePlanRadius = (typeof PAGE_PLAN_RADII)[number];

export interface PagePlanLink {
  readonly label: string;
  /** `#<anchorId>` of a section, or an `https:`, `mailto:` or `tel:` URL. */
  readonly href: string;
}

export interface PagePlanNavItem {
  readonly label: string;
  /** A section's `anchorId`. */
  readonly anchorId: string;
}

export const SECTION_ROLES = ['header', 'hero', 'band', 'cta', 'footer'] as const;
/**
 * What a section IS on the page, which decides its tag and its rules:
 * `header` (nav, at most one, first), `hero` (the page's one h1, right after
 * the header), `band` (any middle section), `cta` (a closing call to action),
 * `footer` (at most one, last).
 */
export type SectionRole = (typeof SECTION_ROLES)[number];

/**
 * One section writer's brief — everything it may know about the page besides
 * the tokens and its neighbours' summaries (`summarizeNeighbours`). No history
 * and no page-level skills reach a writer (agent-audit P1-11/P1-12).
 */
export interface SectionContract {
  /** Stable slug, unique in the plan: `[a-z][a-z0-9-]*`, ≤ 40 characters. */
  readonly key: string;
  readonly role: SectionRole;
  /** The section's label in the page and in history (`Assistant: 2/5 — <title>`). */
  readonly title: string;
  /** The section element's id, unique in the plan; same slug rule as `key`. */
  readonly anchorId: string;
  /** What this section must achieve, in a sentence or two. */
  readonly purpose: string;
  /** Claims or phrases this section MUST carry (≤ 6). */
  readonly mustSay: readonly string[];
  /** Claims another section already makes, which this one must not repeat (≤ 6). */
  readonly mustNotRepeat: readonly string[];
  /** A `SECTION_VARIANTS` id: the named layout the writer builds. */
  readonly variant?: string;
  /** Pictures this section needs, resolved from the photo catalog by subject (≤ 4). */
  readonly images?: readonly SectionImage[];
}

export interface SectionImage {
  /** A photo-catalog topic. */
  readonly subject: PhotoTopic;
  /** Catalog orientation; a candidate's `16:9` / `1:1` / `4:5` is mapped onto it. */
  readonly aspect: PhotoOrientation;
  /** Alt text in the page's language. */
  readonly alt: string;
}

export interface PagePlanFact {
  /** Slug, unique in the plan. */
  readonly key: string;
  /** The invented value the page shows until the owner replaces it. */
  readonly sample: string;
  /** The `key` of the section that shows it. */
  readonly section: string;
}

/** `PagePlan.sections` never holds fewer. A build needs two sections to split. */
export const PAGE_PLAN_MIN_SECTIONS = 2;
/**
 * `PagePlan.sections` never holds more. Equal to `DEFAULT_AI_BUILD_MAX_TASKS`
 * (a test pins it) — declared here rather than imported, because run-build
 * imports this folder and a constant read across that cycle is `undefined` at
 * module-evaluation time.
 */
export const PAGE_PLAN_MAX_SECTIONS = 12;
export const PAGE_PLAN_MAX_NAV_ITEMS = 8;
export const PAGE_PLAN_MAX_FACTS = 32;
export const PAGE_PLAN_MAX_IMAGES_PER_SECTION = 4;
/** Each of `mustSay` and `mustNotRepeat`. */
export const PAGE_PLAN_MAX_SECTION_CLAIMS = 6;

export interface ValidatePagePlanOptions {
  /**
   * Where the page lands, decided by the host (the router's target). When
   * given it REPLACES whatever intent the candidate wrote.
   */
  readonly intent?: PagePlanIntent;
  /** A lower section ceiling, e.g. the build's `maxTasks`. Never above `PAGE_PLAN_MAX_SECTIONS`. */
  readonly maxSections?: number;
}

/**
 * `ok: true` carries the NORMALISED, deeply frozen plan. `ok: false` carries
 * every issue found (not just the first), each phrased as the instruction that
 * fixes it, in document order — the repair round sends them all at once.
 */
export type PagePlanValidationResult =
  | { readonly ok: true; readonly plan: PagePlan; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly PagePlanIssue[] };

// ── what the checker and the neighbour summary read ──────────────────────────

/** A section's writer-owned props as they landed (the region's `tree` and `css`). */
export interface LandedSection {
  readonly tree: JsonValue;
  readonly css?: string;
}

/** Landed sections, keyed by `SectionContract.key`. A key absent here has not landed. */
export type LandedSections = ReadonlyMap<string, LandedSection>;

/**
 * What `checkSection` found wrong in a landed section (agent-audit §3.1 "E").
 *
 * - `raw-colour`: a colour literal or palette class where a token belongs.
 * - `heading-level`: a second h1 on the page, or a hero without its h1.
 * - `cta-label`: a CTA button whose label is not `primaryCta.label`.
 * - `missing-anchor`: the section element lacks its `anchorId`.
 * - `placeholder-left`: `[bracketed]` placeholder text still present.
 * - `foreign-image`: an image URL the catalog resolver did not give.
 * - `contrast`: a text/ground pair in the section below 4.5:1.
 * - `must-say`: a `mustSay` claim is missing.
 * - `repeats`: a `mustNotRepeat` claim appears.
 * - `foreign-font`: a font family other than the plan's two.
 */
export type SectionCheckCode =
  | 'raw-colour'
  | 'heading-level'
  | 'cta-label'
  | 'missing-anchor'
  | 'placeholder-left'
  | 'foreign-image'
  | 'contrast'
  | 'must-say'
  | 'repeats'
  | 'foreign-font';

export interface SectionCheckIssue {
  readonly code: SectionCheckCode;
  /** Phrased as the instruction that repairs it — this text goes to the writer's repair round. */
  readonly message: string;
  /** Where in the tree, as a readable path (`tree.children[2].props.src`), when known. */
  readonly path?: string;
}
