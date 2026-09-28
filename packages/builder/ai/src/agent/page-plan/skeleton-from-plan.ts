import { contrastRatio, parseHex, relativeLuminance, type NodeId } from '@craftkit/builder-schema';

import type { AiPlan, AiPlanStep } from '../../types';
import type {
  PagePlan,
  PagePlanFont,
  PagePlanRadius,
  PagePlanTokens,
  SectionContract,
} from './types';

/** The history label of the skeleton transaction, unchanged from the scaffold build. */
export const PAGE_SKELETON_LABEL = 'Assistant: page skeleton';

export interface SkeletonFromPlanContext {
  /** The node the section regions are inserted under — the page root, or the new page's root. */
  readonly parentId: NodeId;
  /** The parent's slot; absent = its default slot. */
  readonly slot?: string;
  /**
   * Where the first region goes among the parent's children. Absent = at the
   * end. For `intent: 'append'` the host passes the index BEFORE an existing
   * footer, so appended bands never land under it. With `replaceIds` it is
   * read AFTER those children are gone: the removals come first in the plan.
   */
  readonly index?: number;
  /** The block type a section region is (`customCode` in the product). */
  readonly regionType: string;
  /**
   * For `intent: 'replace'`: the parent's children the plan replaces. They are
   * removed in the SAME transaction the regions are inserted in, so one Undo
   * brings the old page back whole.
   */
  readonly replaceIds?: readonly NodeId[];
  /**
   * The root props this root block declares, of the four the skeleton writes
   * (`title`, `description`, `lang`, `pageCss`). A prop the root lacks is not
   * written: the door refuses a step that sets an undeclared prop, and the whole
   * skeleton with it. Absent = all four, as the product's page block declares.
   */
  readonly rootProps?: readonly string[];
  /**
   * The root's `pageCss` as it stands, for `intent: 'append'`: the page keeps
   * it (its fonts, keyframes and kit) and the plan's block is added after it —
   * replacing an earlier plan's block rather than stacking a second one.
   * `replace` and `new-page` write the plan's block alone.
   */
  readonly currentPageCss?: string;
}

/** One region the skeleton creates, and which of its plan steps creates it. */
export interface SkeletonRegion {
  /** `SectionContract.key`. */
  readonly key: string;
  /**
   * The region's label exactly as written: the contract title, cut to the
   * label's 80 UTF-16 units when an emoji makes it longer. Match nodes by this.
   */
  readonly title: string;
  readonly anchorId: string;
  /**
   * Index into `plan.commands` of the `insertNode` that creates this region.
   * The kernel mints ids on apply (`rt.ids.newId()`), so the orchestrator maps
   * each region to its node id from that step's patches after landing.
   */
  readonly step: number;
  /**
   * The skeleton wrote this section in FULL (the header and the footer, from
   * `nav`, `primaryCta`, the section's `mustSay` and its facts), and it already
   * passes `checkSection`: no writer is needed for it. Every other region is a
   * placeholder a writer replaces. Optional only so a hand-built region in a
   * caller's test still type-checks; the skeleton always sets it.
   */
  readonly complete?: boolean;
}

export interface SkeletonFromPlanResult {
  /** One plan, landed as ONE transaction labelled `PAGE_SKELETON_LABEL` through `applyAiPlan`. */
  readonly plan: AiPlan;
  readonly label: typeof PAGE_SKELETON_LABEL;
  /** In page order: `regions[i]` is `pagePlan.sections[i]`. */
  readonly regions: readonly SkeletonRegion[];
}

// ── The component kit ─────────────────────────────────────────────────────────

/**
 * The `ck-` classes the skeleton defines in the page CSS, for a section
 * writer's brief. Colour comes from these (or `var(--ck-*)` in a region's own
 * css), never from a palette class: the AI door admits `ck-` names without a
 * generated utility behind them, while `bg-[var(--ck-accent)]` is an arbitrary
 * value the static vocabulary does not generate — it renders on the live
 * canvas and is absent from the published build.
 */
export const PAGE_KIT_CLASSES: readonly { readonly name: string; readonly use: string }[] =
  Object.freeze([
    { name: 'ck-ground', use: "the page ground: a section's fill, ink text" },
    { name: 'ck-surface', use: 'a raised panel: the card colour, ink text' },
    { name: 'ck-card', use: 'a card: surface fill, hairline border, the page radius' },
    {
      name: 'ck-inverse',
      use: 'an inverted band: ink becomes the ground; every token inside is re-pointed so text, cards and buttons still read',
    },
    {
      name: 'ck-accent-fill',
      use: 'the brand band: accent ground, on-accent text; a ck-btn inside inverts',
    },
    { name: 'ck-ink', use: 'heading and body text colour' },
    { name: 'ck-muted', use: 'secondary text: leads, captions, meta' },
    {
      name: 'ck-accent-ink',
      use: 'accent-coloured TEXT and icons (stats, step numbers, eyebrows)',
    },
    { name: 'ck-border', use: 'hairline colour, beside a border utility (border, border-t)' },
    { name: 'ck-display', use: 'the display face (h1 and h2 already use it)' },
    { name: 'ck-body', use: 'the body face' },
    { name: 'ck-eyebrow', use: 'a small label above a heading, in accent ink' },
    { name: 'ck-btn', use: "the page's primary action: accent fill, on-accent label" },
    { name: 'ck-btn--ghost', use: 'with ck-btn: the secondary action, outlined' },
    { name: 'ck-link', use: 'a quiet text link that turns accent ink on hover' },
  ]);

/** A kit context: the eight colours every `--ck-*` colour property holds inside it. */
export interface PageKitColours {
  readonly bg: string;
  readonly surface: string;
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
  readonly onAccent: string;
  readonly accentInk: string;
  readonly border: string;
}

/** The page's grounds by kit class: what `--ck-*` resolves to on each. */
export interface PageKitGrounds {
  /** The page itself, `ck-ground`, `ck-surface` and `ck-card`: the plan's own tokens. */
  readonly page: PageKitColours;
  readonly inverse: PageKitColours;
  readonly accent: PageKitColours;
}

const AA = 4.5;

function hexOf(channels: { r: number; g: number; b: number }): string {
  const part = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(channels.r)}${part(channels.g)}${part(channels.b)}`;
}

/** `weight` of `a` over `1 - weight` of `b`, per sRGB channel — how CSS mixes a tint. */
function mix(a: string, b: string, weight: number): string {
  const one = parseHex(a);
  const two = parseHex(b);
  if (one === undefined || two === undefined) return a;
  return hexOf({
    r: one.r * weight + two.r * (1 - weight),
    g: one.g * weight + two.g * (1 - weight),
    b: one.b * weight + two.b * (1 - weight),
  });
}

/** The first candidate that clears AA on every ground; else the one that reads best on the worst. */
function readable(candidates: readonly string[], grounds: readonly string[]): string {
  const worst = (colour: string) =>
    Math.min(...grounds.map((ground) => contrastRatio(colour, ground) ?? 0));
  const passing = candidates.find((colour) => worst(colour) >= AA);
  if (passing !== undefined) return passing;
  return [...candidates].sort((left, right) => worst(right) - worst(left))[0] ?? grounds[0] ?? '';
}

/**
 * What every `--ck-*` colour is on each kit ground, computed here so that the
 * CSS the skeleton writes and the contrast the checker measures are the same
 * numbers.
 *
 * The plan validates seven text pairs on the page's own ground and cards; an
 * inverted band or the accent band is a ground the plan never measured, so
 * each text role inside one is chosen by measuring: a softened tint when it
 * clears 4.5:1, the full-strength colour when it does not.
 */
export function pageKitGrounds(tokens: PagePlanTokens): PageKitGrounds {
  const page: PageKitColours = {
    bg: tokens.bg,
    surface: tokens.surface,
    ink: tokens.ink,
    muted: tokens.muted,
    accent: tokens.accent,
    onAccent: tokens.onAccent,
    accentInk: tokens.accentInk,
    border: tokens.border,
  };

  // Inverted: the ink is the ground and the ground the ink (the plan measured that pair).
  const inverseBg = tokens.ink;
  const raised = mix(tokens.bg, tokens.ink, 0.08);
  const inverseSurface = (contrastRatio(tokens.bg, raised) ?? 0) >= AA ? raised : inverseBg;
  const inverseGrounds = [inverseBg, inverseSurface];
  const inverse: PageKitColours = {
    bg: inverseBg,
    surface: inverseSurface,
    ink: tokens.bg,
    muted: readable([mix(tokens.bg, tokens.ink, 0.72), tokens.bg], inverseGrounds),
    accent: tokens.accent,
    onAccent: tokens.onAccent,
    accentInk: readable([tokens.accent, tokens.accentInk, tokens.bg], inverseGrounds),
    border: mix(tokens.bg, tokens.ink, 0.2),
  };

  // The accent band: on-accent is its ink, and a button inside swaps fill and label.
  const accentSurface = mix(tokens.onAccent, tokens.accent, 0.1);
  const accentGrounds = [tokens.accent, accentSurface];
  const accentReads = accentGrounds.every(
    (ground) => (contrastRatio(tokens.onAccent, ground) ?? 0) >= AA,
  );
  const accent: PageKitColours = {
    bg: tokens.accent,
    surface: accentReads ? accentSurface : tokens.accent,
    ink: tokens.onAccent,
    muted: readable([mix(tokens.onAccent, tokens.accent, 0.82), tokens.onAccent], accentGrounds),
    accent: tokens.onAccent,
    onAccent: tokens.accent,
    accentInk: tokens.onAccent,
    border: mix(tokens.onAccent, tokens.accent, 0.3),
  };

  return { page, inverse, accent };
}

// ── The page CSS ──────────────────────────────────────────────────────────────

/*
  The plan's block is fenced by two inert rules (no element carries these
  classes) so a later append can find and replace it. Rules, not comments:
  `scopeCustomCodeCss` reads a comment into the NEXT rule's prelude, and a
  prelude that no longer starts with "@" turns a following `@keyframes` into a
  selector — a comment fence would break the person's own animations.
*/
const BLOCK_START = '.ck-page-plan{--ck-page-plan:1}';
const BLOCK_END = '.ck-page-plan-end{--ck-page-plan:0}';
const PLAN_BLOCK = /\.ck-page-plan\{[^}]*\}[\s\S]*?\.ck-page-plan-end\{[^}]*\}/gu;

const RADIUS: Readonly<Record<PagePlanRadius, { readonly card: string; readonly button: string }>> =
  {
    none: { card: '0', button: '0' },
    md: { card: '0.375rem', button: '0.375rem' },
    xl: { card: '0.75rem', button: '0.75rem' },
    // A pill button, never a lozenge card: text in a 9999px-radius card is clipped at the corners.
    full: { card: '1.5rem', button: '9999px' },
  };

/**
 * The css2 URL as the renderer can import it: every ";" written `%3B`.
 *
 * `scopeCustomCodeCss` lifts imports with `CUSTOM_CSS_FONT_IMPORT`, whose URL
 * stops at the first ";" — so `…wght@400;700…` is cut in two and the rest of
 * the URL is glued onto the next rule's selector. Measured 2026-09-28 by
 * scoping this very CSS with the real function and rendering it in Chromium:
 * written raw, the token rule became `[data-ck="root"] 700&display=swap'); > *`,
 * `--ck-bg` resolved to nothing and body text fell back to Times; written
 * `%3B`, every token resolved and Almarai 400 + 700 and Lalezar loaded. Google
 * Fonts answers `wght@400%3B700` with 200 text/css and every weight (fetched
 * the same day).
 */
function importableUrl(font: PagePlanFont): string {
  return font.url.replaceAll(';', '%3B');
}

function fontStack(family: string): string {
  return `'${family.replace(/['\\]/gu, '')}',system-ui,sans-serif`;
}

function colourProperties(colours: PageKitColours): string {
  return [
    `--ck-bg:${colours.bg}`,
    `--ck-surface:${colours.surface}`,
    `--ck-ink:${colours.ink}`,
    `--ck-muted:${colours.muted}`,
    `--ck-accent:${colours.accent}`,
    `--ck-on-accent:${colours.onAccent}`,
    `--ck-accent-ink:${colours.accentInk}`,
    `--ck-border:${colours.border}`,
  ].join(';');
}

function isRightToLeft(plan: PagePlan): boolean {
  return plan.locale.dir === 'rtl';
}

/**
 * The region marker CustomCode puts on every AI region's host
 * (`CUSTOM_CODE_REGION_ATTRIBUTE`, renderer live-utilities.ts), on the canvas
 * and in the published page alike. A registered block never carries it.
 */
const REGION = '[data-ck-custom-code]';

/*
  The header sticks through its HOST, never by itself. A region renders as
  `div[data-ck][data-ck-custom-code] > header`, and the host is exactly the
  header's height, so `sticky top-0` on the header alone never moved
  (verifier, Chromium 2026-09-28: top -1146px after a 1200px scroll). In the
  published page the host is main's child and sticks along main; on the
  canvas NodeView wraps it in `div[data-bldr-node]` inside a `display:
  contents` slot, so that wrapper is the one that sticks. Unlayered: the host
  and its wrapper carry no utility it could override.
*/
const STICKY_HOST = `${REGION}:has(> header.sticky),:has(> ${REGION} > header.sticky){position:sticky;top:0;z-index:40}`;
/*
  What an anchor jump leaves above its section: the header plus about 19px.
  The header is a fixed number of rows (headerTree), so this can be a fixed
  length. Measured in Chromium on the real scoped CSS, published and canvas
  structures, Arabic and English, a 10-character and a 43-character brand,
  3 and 8 nav items (2026-09-28): the header is 109px at 360, 390 and 768px
  wide and 77px at 1280px, and every nav jump landed 19px below it.
*/
const HEADER_CLEARANCE = '8rem';
const HEADER_CLEARANCE_LG = '6rem';

/*
  The header bar's layout, from the kit because the door generates no
  `lg:flex-nowrap` or `lg:flex-initial` (validateAiPlan: "utility classes with
  no generated CSS", 2026-09-28). Below lg the bar wraps the nav onto row two
  and the brand takes the room the button leaves; from lg the bar is one row
  and the brand only its own width. The header carries no utility for either
  property: a utility would beat these component-layer rules at every width.
  Then the sticky header covers the top of every section an anchor jumps to.
*/
const HEADER_KIT = [
  '.ck-bar{flex-wrap:wrap}',
  '.ck-brand{flex:1 1 0%}',
  '@media (min-width:64rem){.ck-bar{flex-wrap:nowrap}.ck-brand{flex:0 1 auto}}',
  `${REGION} [id]{scroll-margin-top:${HEADER_CLEARANCE}}`,
  `@media (min-width:64rem){${REGION} [id]{scroll-margin-top:${HEADER_CLEARANCE_LG}}}`,
];

/**
 * The plan's page CSS: font imports, the tokens, the component kit.
 *
 * The tokens sit on `> *`, which the renderer scopes to `[data-ck="<root>"] > *`
 * — the children of the page's `main` — and custom properties inherit from
 * there into every region (checked in Chromium 2026-09-28 on the real scoped
 * output inside region hosts `div[data-ck]`: ground, ink, faces and the
 * re-pointed `ck-inverse` tokens all resolved). `:root`, `html` or `body`
 * would be scoped into selectors that match nothing; `*` would re-declare
 * every token on every element, so a `ck-inverse` band could never re-point
 * them for its children.
 *
 * Only custom properties sit there: they style nothing until a rule reads
 * them. Every rule that styles an element names the region marker or a `ck-`
 * class, so the page CSS never restyles content the plan does not own — on
 * an append, the registered blocks already on the page. (Verifier, Chromium
 * 2026-09-28: `> *{font-family;color}` and a bare `h1,h2` turned a registered
 * block's h2 into Lalezar, its body into Almarai and its text emerald.)
 */
export function pagePlanCss(plan: PagePlan): string {
  const { tokens } = plan;
  const grounds = pageKitGrounds(tokens);
  const radius = RADIUS[tokens.radius];
  const imports = [...new Set([importableUrl(tokens.fontDisplay), importableUrl(tokens.fontBody)])];
  /*
    Arabic letters join: tracking pulls a word's letters apart and there are no
    capitals to set, so an Arabic eyebrow is weight and colour alone.
  */
  const eyebrow = isRightToLeft(plan)
    ? 'color:var(--ck-accent-ink);font-size:0.875rem;font-weight:700'
    : 'color:var(--ck-accent-ink);font-size:0.8125rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase';
  const hasHeader = plan.sections.some(({ role }) => role === 'header');

  /*
    The kit is a Tailwind COMPONENT layer, so a utility on the same element
    still wins — `ck-btn px-8` sizes the button, `ck-card rounded-none` squares
    the card. Tailwind v4 layers its utilities (the playground imports
    `tailwindcss`), and an unlayered rule beats every layered one whatever its
    specificity: written bare, the kit silently overrode each utility a writer
    put beside it. The token rule stays unlayered: it holds only custom
    properties, on the page's own children, which carry no utilities.
  */
  const kit = [
    `${REGION}{font-family:var(--ck-font-body);color:var(--ck-ink)}`,
    `${REGION} :is(h1,h2),.ck-display{font-family:var(--ck-font-display)}`,
    '.ck-body{font-family:var(--ck-font-body)}',
    '.ck-ground{background-color:var(--ck-bg);color:var(--ck-ink)}',
    '.ck-surface{background-color:var(--ck-surface);color:var(--ck-ink)}',
    '.ck-card{background-color:var(--ck-surface);color:var(--ck-ink);border:1px solid var(--ck-border);border-radius:var(--ck-radius)}',
    `.ck-inverse{${colourProperties(grounds.inverse)};background-color:var(--ck-bg);color:var(--ck-ink)}`,
    `.ck-accent-fill{${colourProperties(grounds.accent)};background-color:var(--ck-bg);color:var(--ck-ink)}`,
    '.ck-ink{color:var(--ck-ink)}',
    '.ck-link{text-decoration:none;transition:color 150ms}',
    '.ck-link:hover{color:var(--ck-accent-ink)}',
    '.ck-muted{color:var(--ck-muted)}',
    '.ck-accent-ink{color:var(--ck-accent-ink)}',
    '.ck-border{border-color:var(--ck-border)}',
    `.ck-eyebrow{${eyebrow}}`,
    '.ck-btn{display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.75rem 1.5rem;border-radius:var(--ck-radius-button);background-color:var(--ck-accent);color:var(--ck-on-accent);font-weight:600;line-height:1.25;text-decoration:none;white-space:nowrap;transition:filter 150ms,transform 150ms}',
    '.ck-btn:hover{filter:brightness(1.08)}',
    '.ck-btn:focus-visible{outline:2px solid var(--ck-accent-ink);outline-offset:2px}',
    '.ck-btn--ghost{background-color:transparent;color:var(--ck-ink);box-shadow:inset 0 0 0 1px var(--ck-border)}',
    ...(hasHeader ? HEADER_KIT : []),
  ];
  return [
    BLOCK_START,
    ...imports.map((url) => `@import url('${url}');`),
    `> *{${colourProperties(grounds.page)};--ck-radius:${radius.card};--ck-radius-button:${radius.button};--ck-font-display:${fontStack(tokens.fontDisplay.family)};--ck-font-body:${fontStack(tokens.fontBody.family)}}`,
    ...(hasHeader ? [STICKY_HOST] : []),
    `@layer components{\n${kit.join('\n')}\n}`,
    BLOCK_END,
  ].join('\n');
}

/** The page CSS to write: the plan's block alone, or appended to what the page keeps. */
function pageCssFor(plan: PagePlan, context: SkeletonFromPlanContext): string {
  const block = pagePlanCss(plan);
  if (plan.intent !== 'append') return block;
  const kept = (context.currentPageCss ?? '').replace(PLAN_BLOCK, '').trim();
  return kept === '' ? block : `${kept}\n${block}`;
}

// ── The region trees ──────────────────────────────────────────────────────────

interface TreeElement {
  readonly kind: 'element';
  readonly tag: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly TreeElement[];
}

function el(
  tag: string,
  className: string,
  content: { text?: string; attributes?: Record<string, string>; children?: TreeElement[] } = {},
): TreeElement {
  return {
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(content.text === undefined ? {} : { text: content.text }),
    ...(content.attributes === undefined ? {} : { attributes: content.attributes }),
    ...(content.children === undefined ? {} : { children: content.children }),
  };
}

function root(child: TreeElement): { kind: 'root'; children: TreeElement[] } {
  return { kind: 'root', children: [child] };
}

/** Cut to `max` UTF-16 units (what zod's `.max` counts) at a word, with an ellipsis. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  // Never half a surrogate pair: a lone one renders as a replacement box.
  const lead = text.charCodeAt(max - 2);
  const head = text.slice(0, lead >= 0xd800 && lead <= 0xdbff ? max - 2 : max - 1);
  const space = head.lastIndexOf(' ');
  const cut = space >= max - 30 ? head.slice(0, space) : head;
  return `${cut.trimEnd()}…`;
}

const TITLE_SEPARATOR = /\s+[|·•—–:-]\s+/u;

/** The name a header and footer show: the title before an SEO separator ("Name | Tagline"). */
function brandName(plan: PagePlan): string {
  const [name = plan.title] = plan.title.split(TITLE_SEPARATOR);
  return clamp(name.trim() === '' ? plan.title : name.trim(), 40);
}

const COPY: Readonly<
  Record<string, { readonly nav: string; readonly rights: (brand: string) => string }>
> = {
  ar: { nav: 'أقسام الصفحة', rights: (brand) => `© ${brand} — جميع الحقوق محفوظة` },
  en: { nav: 'Page sections', rights: (brand) => `© ${brand}. All rights reserved.` },
};

function copyFor(plan: PagePlan): {
  readonly nav: string;
  readonly rights: (brand: string) => string;
} {
  const primary = plan.locale.lang.split('-')[0] ?? plan.locale.lang;
  // Any other language: no words the page did not choose — the brand stands in.
  return COPY[primary] ?? { nav: brandName(plan), rights: (brand) => `© ${brand}` };
}

const EASTERN_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/gu;
const PHONE = /^\+?[\d\s().-]+$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function asciiDigits(text: string): string {
  return text.replace(EASTERN_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/*
  A phone number is a left-to-right run inside a right-to-left line: unisolated,
  "+962 7 9000 0000" renders as "7 9000 0000 962+". The tree has no `dir`
  attribute, so the run is wrapped in Unicode isolates (LRI … PDI), which
  render as nothing and keep the digits in the order they are dialled.
*/
const LTR_ISOLATE = '\u2066';
const POP_ISOLATE = '\u2069';

/** A line of contact text; a phone number or an e-mail address becomes the link it names. */
function contactLine(text: string, rtl: boolean): TreeElement {
  const ascii = asciiDigits(text.trim());
  const digits = ascii.replace(/\D/gu, '');
  if (PHONE.test(ascii) && digits.length >= 7) {
    const href = `tel:${ascii.startsWith('+') ? '+' : ''}${digits}`;
    const shown = rtl ? `${LTR_ISOLATE}${text.trim()}${POP_ISOLATE}` : text.trim();
    return el('p', '', { children: [el('a', 'ck-link', { text: shown, attributes: { href } })] });
  }
  if (EMAIL.test(ascii)) {
    return el('p', '', {
      children: [el('a', 'ck-link', { text, attributes: { href: `mailto:${ascii}` } })],
    });
  }
  return el('p', '', { text });
}

function navLinks(plan: PagePlan, className: string): TreeElement[] {
  return plan.nav.map(({ label, anchorId }) =>
    el('a', className, { text: label, attributes: { href: `#${anchorId}` } }),
  );
}

function ctaLink(plan: PagePlan, className: string): TreeElement {
  return el('a', className, {
    text: plan.primaryCta.label,
    attributes: { href: plan.primaryCta.href },
  });
}

/**
 * The header, complete: the brand (linking to the page top), the nav and the
 * page's one action. Below `lg` the links drop to a second, scrollable row
 * under the brand and the button — no menu toggle, because a tree cannot carry
 * a handler — and from `lg` they sit in the bar.
 *
 * A fixed number of rows whatever the plan holds, because the anchors' scroll
 * margin is a fixed length (HEADER_CLEARANCE): the brand shares row one with
 * the button and cuts itself short with an ellipsis rather than wrapping onto
 * a row of its own, the nav is one scrolling line, and from `lg` the bar does
 * not wrap at all — a long nav scrolls inside it.
 */
function headerTree(plan: PagePlan, contract: SectionContract): TreeElement {
  const copy = copyFor(plan);
  const brand = el('div', 'ck-brand flex min-w-0 items-center gap-4', {
    children: [
      el('a', 'ck-display ck-link truncate text-xl font-bold', {
        text: brandName(plan),
        attributes: { href: `#${contract.anchorId}` },
      }),
      ...contract.mustSay.map((claim) =>
        el('p', 'ck-muted hidden truncate text-xs lg:block', { text: claim }),
      ),
    ],
  });
  const nav =
    plan.nav.length === 0
      ? []
      : [
          el(
            'nav',
            'order-last flex w-full gap-6 overflow-x-auto text-sm font-medium lg:order-none lg:w-auto',
            {
              attributes: { 'aria-label': copy.nav },
              children: navLinks(plan, 'ck-link ck-muted whitespace-nowrap'),
            },
          ),
        ];
  return el('header', 'ck-surface sticky top-0 z-40 border-b ck-border', {
    attributes: { id: contract.anchorId },
    children: [
      el(
        'div',
        'ck-bar mx-auto flex max-w-6xl items-center justify-between gap-x-8 gap-y-3 px-4 py-4 md:px-8',
        { children: [brand, ...nav, ctaLink(plan, 'ck-btn shrink-0 text-sm')] },
      ),
    ],
  });
}

/**
 * The footer, complete: brand and description, the nav as a link column, the
 * section's own claims (an address, hours) and the facts the plan placed here
 * (a phone or e-mail becomes its link), then the copyright line.
 *
 * Dark on a light page, raised on a dark one: an inverted footer on a dark
 * page would be the one white slab at the bottom of it.
 */
function footerTree(plan: PagePlan, contract: SectionContract): TreeElement {
  const light = relativeLuminance(parseHex(plan.tokens.bg) ?? { r: 1, g: 1, b: 1 }) > 0.5;
  const ground = light ? 'ck-inverse' : 'ck-surface border-t ck-border';
  const brand = brandName(plan);
  const facts = plan.facts.filter(({ section }) => section === contract.key);
  const lines = [...contract.mustSay, ...facts.map(({ sample }) => sample)];
  const columns: TreeElement[] = [
    el('div', '', {
      children: [
        el('p', 'ck-display text-2xl font-bold', { text: brand }),
        el('p', 'ck-muted mt-3 max-w-sm text-sm leading-relaxed', {
          text: clamp(plan.description, 200),
        }),
      ],
    }),
  ];
  if (plan.nav.length > 0) {
    columns.push(
      el('nav', '', {
        attributes: { 'aria-label': copyFor(plan).nav },
        children: [
          el('ul', 'space-y-2 text-sm', {
            children: navLinks(plan, 'ck-link').map((link) => el('li', '', { children: [link] })),
          }),
        ],
      }),
    );
  }
  if (lines.length > 0) {
    const rtl = isRightToLeft(plan);
    columns.push(
      el('div', 'space-y-2 text-sm', { children: lines.map((line) => contactLine(line, rtl)) }),
    );
  }
  return el('footer', ground, {
    attributes: { id: contract.anchorId },
    children: [
      el('div', 'mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3 md:px-8', {
        children: columns,
      }),
      el('div', 'border-t ck-border', {
        children: [
          el('p', 'ck-muted mx-auto max-w-6xl px-4 py-6 text-xs md:px-8', {
            text: copyFor(plan).rights(brand),
          }),
        ],
      }),
    ],
  });
}

/**
 * The placeholder a writer replaces — the scaffold's markup contract, which
 * the lander reads roles from: the hero's heading is the page's one h1, every
 * other placeholder a `section` with its title as an h2.
 */
function placeholderTree(plan: PagePlan, contract: SectionContract): TreeElement {
  const hero = contract.role === 'hero';
  const heading = hero
    ? el(
        'h1',
        `text-4xl font-bold text-balance md:text-6xl ${isRightToLeft(plan) ? 'leading-snug' : 'leading-tight'}`,
        { text: contract.title },
      )
    : el('h2', 'text-3xl font-semibold text-balance md:text-4xl', { text: contract.title });
  return el(
    'section',
    hero ? 'ck-ground relative overflow-hidden py-24 md:py-32' : 'ck-ground py-16 md:py-24',
    {
      attributes: { id: contract.anchorId },
      children: [el('div', 'mx-auto max-w-6xl px-4 md:px-8', { children: [heading] })],
    },
  );
}

function regionTree(plan: PagePlan, contract: SectionContract): TreeElement {
  if (contract.role === 'header') return headerTree(plan, contract);
  if (contract.role === 'footer') return footerTree(plan, contract);
  return placeholderTree(plan, contract);
}

// ── The plan ──────────────────────────────────────────────────────────────────

const ROOT_PROPS = ['title', 'description', 'lang', 'pageCss'] as const;
/** The product page block's own limits (editor Page/schema.ts): the plan allows a longer description. */
const PAGE_TITLE_MAX = 120;
const PAGE_DESCRIPTION_MAX = 200;
const PAGE_LANG_MAX = 12;
const REGION_LABEL_MAX = 80;

/**
 * Step T2 of the page build: the page's skeleton, written by CODE from a
 * validated plan — no model call (agent-audit §3.1).
 *
 * The plan it returns contains only `removeNode` (for `replaceIds`),
 * `setDocMeta`, `setProp` and `insertNode` steps, in that order, and still
 * goes through the kernel door:
 *
 * - `setDocMeta {dir}` and the root's `title`, `description` (cut to the page
 *   block's 200) and `lang` — except when appending, where the page keeps the
 *   identity it already has.
 * - `pageCss`: the font imports, the tokens as custom properties (`--ck-bg`,
 *   `--ck-surface`, `--ck-ink`, `--ck-muted`, `--ck-accent`, `--ck-on-accent`,
 *   `--ck-accent-ink`, `--ck-border`, `--ck-radius`, `--ck-radius-button`,
 *   `--ck-font-display`, `--ck-font-body`) and the component kit
 *   (`PAGE_KIT_CLASSES`), fenced so a later append replaces it.
 * - one region per section, in page order, carrying its `anchorId` on its
 *   outer element and its title as the label: the header and footer written
 *   in full from the plan, every other section a role-correct placeholder.
 *
 * Pure and deterministic: the same plan and context give the same steps.
 *
 * @throws never for a plan that passed `validatePagePlan`.
 */
export function skeletonFromPlan(
  plan: PagePlan,
  context: SkeletonFromPlanContext,
): SkeletonFromPlanResult {
  const declared = new Set<string>(context.rootProps ?? ROOT_PROPS);
  const parentId = context.parentId;
  const commands: AiPlanStep[] = [];
  const setRoot = (key: string, value: string): void => {
    if (declared.has(key))
      commands.push({ command: 'setProp', args: { id: parentId, key, value } });
  };

  for (const id of context.replaceIds ?? []) {
    commands.push({ command: 'removeNode', args: { id } });
  }
  if (plan.intent !== 'append') {
    commands.push({ command: 'setDocMeta', args: { dir: plan.locale.dir } });
    setRoot('title', clamp(plan.title, PAGE_TITLE_MAX));
    setRoot('description', clamp(plan.description, PAGE_DESCRIPTION_MAX));
    const { lang } = plan.locale;
    setRoot('lang', lang.length <= PAGE_LANG_MAX ? lang : (lang.split('-')[0] ?? lang));
  }
  setRoot('pageCss', pageCssFor(plan, context));

  const regions = plan.sections.map((contract, position): SkeletonRegion => {
    const step = commands.length;
    /*
      The plan counts a title in code points (80), the label schema in UTF-16
      units (80): a title holding an emoji can be cut here. The region reports
      the label it WROTE, because run-build finds each region's node by
      `label === title` — a raw title that differed got no task at all.
    */
    const label = clamp(contract.title, REGION_LABEL_MAX);
    commands.push({
      command: 'insertNode',
      args: {
        type: context.regionType,
        parentId,
        ...(context.slot === undefined ? {} : { slot: context.slot }),
        ...(context.index === undefined ? {} : { index: context.index + position }),
        props: { label, tree: root(regionTree(plan, contract)) },
      },
    });
    return {
      key: contract.key,
      title: label,
      anchorId: contract.anchorId,
      step,
      complete: contract.role === 'header' || contract.role === 'footer',
    };
  });

  return {
    plan: {
      rationale: `The page skeleton for "${plan.title}": ${String(plan.sections.length)} sections, the plan's tokens, faces and component kit.`,
      commands,
    },
    label: PAGE_SKELETON_LABEL,
    regions,
  };
}
