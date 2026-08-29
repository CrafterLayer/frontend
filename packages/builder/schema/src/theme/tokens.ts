/**
 * The page's token vocabulary.
 *
 * MOVED HERE from `@craftkit/builder-renderer` (feature 013). It had to move
 * down a layer for a concrete reason, not a tidy one: the renderer is layer 2
 * and so is the AI planner, and ADR 0003 forbids sideways edges. The planner
 * therefore could not import the vocabulary it is being asked to GENERATE.
 * Duplicating the list into the planner would have created two sources of
 * truth for the same tokens, which drift the first time a token is added.
 * At layer 0 the renderer, the planner, the shell, and every extension can all
 * read one list. The renderer re-exports every name below, so no consumer's
 * import broke.
 *
 * Split in two on purpose. Colour roles are what a person picks in a colour
 * control; measurements are what a page is BUILT from — spacing, widths, radii,
 * the sizes of a control. Both are theme keys, and the split is what keeps a
 * measurement out of a colour picker without anyone having to remember to
 * exclude it.
 *
 * Every token here must be one a block actually consumes. The inverse also has
 * to hold, and it is the reason this list grew: a stylesheet writing
 * `var(--t-section-spacing-lg, 64px)` against a token the theme never defines
 * is not themed at all — it is a hard-coded 64px wearing a token's clothes, and
 * re-pointing the theme cannot move it.
 */
export type ColorToken =
  | 'surface'
  | 'surfaceInverse'
  | 'text'
  | 'textInverse'
  | 'textMuted'
  | 'accent'
  | 'accentText'
  /*
    Status. A page says "saved", "sold out" or "beta" as often as it says "buy",
    and the demo announcement block was already reaching for `--t-success` —
    which no theme defined, so every one of those resolved to a hard-coded green
    forever, unmovable by any theme.
  */
  | 'success'
  | 'successText';

export type MeasurementToken =
  | 'radius'
  /* The rhythm between things inside a section. */
  | 'gap'
  | 'gapXs'
  | 'gapSm'
  | 'gapLg'
  /* The rhythm between sections. */
  | 'sectionSpacingSm'
  | 'sectionSpacingMd'
  | 'sectionSpacingLg'
  /* The breathing room at the page's edge — without it text meets the glass. */
  | 'gutter'
  /* How wide a column of content is allowed to get. */
  | 'contentWidthNarrow'
  | 'contentWidthStandard'
  | 'contentWidthWide'
  /* The outer document root, distinct from the columns sections place inside it. */
  | 'pageWidth'
  /* The narrowest a grid column may get before the grid drops a column. */
  | 'gridMinTrack'
  /*
    What ONE STEP of spacing is worth.

    Padding and margin are typed as NUMBERS of steps, not lengths: the law in
    `packages/builder/schema/src/blocks/style-values.ts` scans strings and
    refuses `"16px"`, and a number is not a literal. So a person types `4` and
    the renderer resolves `calc(var(--t-space-unit) * 4)` — a real numeric
    control that still leaves the theme in charge of the rhythm. Re-point this
    one token and every margin on the site rescales together.
  */
  | 'spaceUnit'
  /* A hairline. Every page border reads this, so one edit restyles the site. */
  | 'borderWidth'
  /* Elevation, as two named steps rather than a shadow anyone can hand-write. */
  | 'shadowSoft'
  | 'shadowStrong'
  /* The bar heights a header offers, as a scale rather than free numbers. */
  | 'barHeightCompact'
  | 'barHeightRegular'
  | 'barHeightTall'
  /* Type steps the page needs beyond body and small. */
  | 'fontSizeLg'
  | 'fontSizeXl'
  /* The tracking an uppercase label needs to stay readable. */
  | 'letterSpacingWide'
  /*
    Typography, as a SCALE rather than free numbers.

    GrapesJS offers `font-size: 14px` and `color: black` straight into the
    element's style. This product cannot: a document may hold no literal, which
    is exactly what lets one theme edit restyle every page ever authored. So the
    control offers a step on this scale and the document stores the step's NAME.
  */
  | 'fontSizeXs'
  | 'fontSizeBase'
  | 'fontSizeXxl'
  | 'fontWeightRegular'
  | 'fontWeightMedium'
  | 'fontWeightSemibold'
  | 'fontWeightBold'
  | 'lineHeightTight'
  | 'lineHeightNormal'
  | 'lineHeightRelaxed'
  | 'letterSpacingTight'
  | 'letterSpacingNormal'
  /* The families a page may set. Stacks, so a missing face still renders. */
  | 'fontFamilySans'
  | 'fontFamilySerif'
  | 'fontFamilyMono'
  /* Type. */
  | 'fontSizeSm'
  /*
    How far a revealing element travels, and how far a parallax layer drifts.

    These are theme decisions, not constants: a restrained brand wants a
    shorter travel than a playful one, and a document must be able to say so
    without any block hard-coding a distance. They were literals inside the
    motion stylesheet until the token-coverage gate pointed out that a
    `var(--t-motion-distance, 24px)` no theme defines is a hard-coded 24px
    wearing a token's clothes.
  */
  | 'motionDistance'
  | 'motionParallax'
  /* The inside of a control, which is what makes a button feel its size. */
  | 'controlPaddingBlockSm'
  | 'controlPaddingBlockMd'
  | 'controlPaddingBlockLg'
  | 'controlPaddingInlineSm'
  | 'controlPaddingInlineMd'
  | 'controlPaddingInlineLg';

export type TokenName = ColorToken | MeasurementToken;

/** A theme is a complete token assignment; blocks consume ONLY var(--t-…) names. */
export type Theme = Record<TokenName, string>;

const kebab = (name: string): string => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

/**
 * The custom property a token is read through.
 *
 * Moved down with the vocabulary rather than left behind: the Tailwind bridge
 * and the planner both have to name a token's variable, and a second
 * implementation of this three-line function is a second chance to disagree
 * about the prefix.
 */
export function tokenCssName(name: TokenName): string {
  return `--t-${kebab(name)}`;
}
