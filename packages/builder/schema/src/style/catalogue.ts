/**
 * The property catalogue (style-manager DESIGN.md §A.4) as data.
 *
 * One entry per control the panel shows, in panel order. Each entry says how
 * its value is written as a Tailwind utility (prefix, options, token kind,
 * which raw values it admits, logical sides), what control edits it, which
 * quick bars carry it, and its labels in English and Arabic. The engine reads
 * the same table, so a property the panel shows is a property the engine can
 * write, and the agent tools can describe both from here.
 *
 * Laws (§0.2): sides are logical (`ps/pe/pbs/pbe`, `inset-s/e`,
 * `rounded-ss/se/es/ee`, `border-s/e/bs/be`); labels say start/end. Physical
 * classes (`pl`, `left-4`, `rounded-tl`) are READ so they can be replaced, and
 * are never written.
 */
import type { StyleBoxSide, StyleCorner, StyleLabels, StyleSide } from './types';

export const STYLE_PROPERTY_IDS = [
  // Layout
  'display',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'gap',
  'columnGap',
  'rowGap',
  'gridColumns',
  'gridRows',
  'columnSpan',
  'order',
  'placeItems',
  // Spacing
  'padding',
  'margin',
  // Size
  'inlineSize',
  'blockSize',
  'minInlineSize',
  'maxInlineSize',
  'minBlockSize',
  'maxBlockSize',
  'aspectRatio',
  'overflowInline',
  'overflowBlock',
  'objectFit',
  'objectPosition',
  // Position
  'position',
  'inset',
  'zIndex',
  // Typography
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textColor',
  'textAlign',
  'textTransform',
  'textDecorationLine',
  'textDecorationStyle',
  'textDecorationColor',
  'textDecorationThickness',
  'underlineOffset',
  'fontStyle',
  'textWrap',
  'whiteSpace',
  'textShadow',
  'listStyle',
  'textOverflow',
  'lineClamp',
  // Backgrounds
  'backgroundColor',
  'gradientDirection',
  'gradientFrom',
  'gradientVia',
  'gradientTo',
  'backgroundImage',
  'backgroundSize',
  'backgroundPosition',
  'backgroundRepeat',
  'backgroundAttachment',
  'backgroundClip',
  // Borders
  'borderWidth',
  'borderStyle',
  'borderColor',
  'borderRadius',
  'outlineWidth',
  'outlineStyle',
  'outlineColor',
  'outlineOffset',
  'divideInline',
  'divideBlock',
  'divideColor',
  // Effects
  'boxShadow',
  'insetShadow',
  'opacity',
  'blur',
  'backdropBlur',
  'brightness',
  'contrast',
  'saturate',
  'grayscale',
  'hueRotate',
  'mixBlend',
  'mask',
  'effects',
  // Transforms
  'translateInline',
  'translateBlock',
  'rotate',
  'scale',
  'skewInline',
  'skewBlock',
  'transformOrigin',
  'perspective',
  // Transitions
  'transitionProperty',
  'transitionDuration',
  'transitionEasing',
  'transitionDelay',
  // Motion & interactions (attributes, §B)
  'motion',
  'hoverMotion',
  // Advanced
  'direction',
] as const;

/** One id per row of §A.4. Closed: an unknown id is a type error. */
export type StylePropertyId = (typeof STYLE_PROPERTY_IDS)[number];

export type StyleSectorId =
  | 'layout'
  | 'spacing'
  | 'size'
  | 'position'
  | 'typography'
  | 'backgrounds'
  | 'borders'
  | 'effects'
  | 'transforms'
  | 'transitions'
  | 'motion'
  | 'advanced';

export type StyleControlKind =
  'color' | 'number' | 'radio' | 'select' | 'slider' | 'composite' | 'stack' | 'text' | 'keyword';

/** The quick-bar element kinds of §A.6. */
export type StyleElementKind = 'text' | 'container' | 'media' | 'link' | 'icon';

/**
 * Which tokens a property admits after its prefix.
 * - `list`: exactly the `scale` entries.
 * - `color`: colour roles, white/black/transparent/current/inherit, Tailwind's
 *   palette (`blue-500`), each with an optional `/opacity`.
 * - `spacing`: the numeric scale (`4`, `0.5`), `px`, and the named spacing tokens.
 * - `inline-size` / `block-size`: spacing plus fractions and the size keywords.
 * - `number`: any non-negative number, plus the `scale` entries.
 */
export type StyleTokenKind = 'list' | 'color' | 'spacing' | 'inline-size' | 'block-size' | 'number';

/**
 * How an arbitrary value `[…]` is recognised as this property's (several
 * properties share a prefix: `text-[17px]` is a size, `text-[#fff]` a colour).
 * The engine adds a Tailwind type hint (`length:`) when a value would be
 * read as the other property.
 */
export type StyleRawKind = 'color' | 'length' | 'number' | 'image' | 'family' | 'shadow' | 'any';

export interface StyleOption {
  /** The keyword: what `{ kind: 'keyword', keyword }` carries. */
  readonly value: string;
  /** The class(es) written, without variants. Space-separated for the gradient pair. */
  readonly className: string;
  readonly labels?: StyleLabels;
  /** Read (so it can be replaced) but not offered: physical `text-left`. */
  readonly legacy?: true;
}

/** A physical class in a sided family: read as a logical side, or only replaced. */
export interface StylePhysicalSide {
  /** The logical side it equals in horizontal writing (`pt` = block-start), if any. */
  readonly reads?: StyleBoxSide | StyleCorner;
  /** The logical sides it may touch; a write to any of them removes it. */
  readonly overlaps: readonly (StyleBoxSide | StyleCorner)[];
}

export interface StyleSidePrefixes {
  /** The utility prefix for each logical side group, e.g. `inline-start: 'ps'`. */
  readonly logical: Readonly<Partial<Record<StyleSide, string>>>;
  readonly physical: Readonly<Record<string, StylePhysicalSide>>;
}

export interface StyleRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface StylePropertyDef {
  readonly id: StylePropertyId;
  readonly sector: StyleSectorId;
  readonly control: StyleControlKind;
  /** The conflict family: an intent removes the whole family at its bucket and state. */
  readonly family: string;
  readonly labels: StyleLabels;
  /** The quick bars (§A.6) that carry this control. */
  readonly quickBar: readonly StyleElementKind[];
  /** `attribute` properties are not classes (§A.2): direction and motion. */
  readonly storage: 'class' | 'attribute';
  readonly attribute?: string;
  /** Utility prefix for token, raw and palette values: `bg` → `bg-accent`. */
  readonly prefix?: string;
  readonly options?: readonly StyleOption[];
  /** Suggested token steps for the control (and the whole token set for `list`). */
  readonly scale?: readonly string[];
  readonly tokens?: StyleTokenKind;
  /** Admits raw values (free mode), recognised as this kind. */
  readonly raw?: StyleRawKind;
  /** Admits site-library palette colours `(--ck-c-<id>)`. */
  readonly palette?: true;
  /** Admits negative tokens (`-4` → `-mbs-4`). */
  readonly negative?: true;
  /** The keyword the bare prefix means: `border` → `default` (1px). */
  readonly bare?: string;
  readonly sides?: 'box' | 'corners';
  readonly sidePrefixes?: StyleSidePrefixes;
  readonly units?: readonly string[];
  readonly range?: StyleRange;
  /** Controls the panel renders together (the gradient composite). */
  readonly group?: string;
  /** Other prefixes read as this property and replaced by it: `w` for inline size. */
  readonly aliases?: readonly string[];
  /** A two-axis shorthand split on write: `size-8` keeps its `block-8` half. */
  readonly shorthand?: { readonly prefix: string; readonly counterpart: string };
  /** Only at base + default (hook classes take no variants). */
  readonly baseOnly?: true;
  /** A keyword may name several options at once (`glass noise`). */
  readonly multi?: true;
  /** Where the options come from when another module owns them. */
  readonly optionsFrom?: string;
}

export interface StyleSector {
  readonly id: StyleSectorId;
  readonly labels: StyleLabels;
  readonly properties: readonly StylePropertyDef[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function L(en: string, ar: string): StyleLabels {
  return { en, ar };
}

function opt(value: string, className: string, en?: string, ar?: string): StyleOption {
  return en === undefined || ar === undefined
    ? { value, className }
    : { value, className, labels: L(en, ar) };
}

function legacy(value: string, className: string): StyleOption {
  return { value, className, legacy: true };
}

/** Options whose class is `<prefix>-<value>`. */
function prefixed(
  prefix: string,
  values: readonly (readonly [string, string, string])[],
): StyleOption[] {
  return values.map(([value, en, ar]) => opt(value, `${prefix}-${value}`, en, ar));
}

const LENGTH_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh', 'dvh', 'ch'] as const;
const TIME_UNITS = ['ms', 's'] as const;
const ANGLE_UNITS = ['deg', 'turn'] as const;

export const SPACING_SCALE: readonly string[] = [
  '0',
  'px',
  '0.5',
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '14',
  '16',
  '20',
  '24',
  '28',
  '32',
  '40',
  '48',
  '56',
  '64',
  '72',
  '80',
  '96',
];

const SIZE_KEYWORDS = ['auto', 'full', 'fit', 'min', 'max'] as const;
const RADIUS_SCALE = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full', 'base'];
const BLUR_SCALE = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
const FILTER_PERCENT = ['0', '50', '75', '90', '95', '100', '105', '110', '125', '150', '200'];

const BOX_SIDES: readonly StyleSide[] = [
  'all',
  'block',
  'inline',
  'block-start',
  'block-end',
  'inline-start',
  'inline-end',
];

function boxPrefixes(
  all: string,
  block: string,
  inline: string,
  bs: string,
  be: string,
  is: string,
  ie: string,
  physical: Readonly<Record<string, StylePhysicalSide>>,
): StyleSidePrefixes {
  return {
    logical: {
      all,
      block,
      inline,
      'block-start': bs,
      'block-end': be,
      'inline-start': is,
      'inline-end': ie,
    },
    physical,
  };
}

const INLINE_PAIR: readonly StyleBoxSide[] = ['inline-start', 'inline-end'];
const TOP_ROW: readonly StyleCorner[] = ['start-start', 'start-end'];
const BOTTOM_ROW: readonly StyleCorner[] = ['end-start', 'end-end'];
const ALL_CORNERS: readonly StyleCorner[] = [...TOP_ROW, ...BOTTOM_ROW];

type Def = Omit<StylePropertyDef, 'id' | 'family' | 'storage' | 'quickBar'> & {
  readonly family?: string;
  readonly storage?: 'class' | 'attribute';
  readonly quickBar?: readonly StyleElementKind[];
};

// ── The table ──────────────────────────────────────────────────────────────

const DEFS: Readonly<Record<StylePropertyId, Def>> = {
  // ── Layout ──
  display: {
    sector: 'layout',
    control: 'radio',
    labels: L('Display', 'طريقة العرض'),
    quickBar: ['container'],
    options: [
      opt('block', 'block', 'Block', 'كتلة'),
      opt('flex', 'flex', 'Flex', 'مرن'),
      opt('grid', 'grid', 'Grid', 'شبكة'),
      opt('inline', 'inline', 'Inline', 'سطري'),
      opt('inline-block', 'inline-block', 'Inline block', 'كتلة سطرية'),
      opt('inline-flex', 'inline-flex', 'Inline flex', 'مرن سطري'),
      opt('inline-grid', 'inline-grid', 'Inline grid', 'شبكة سطرية'),
      opt('contents', 'contents', 'Contents', 'المحتوى فقط'),
      opt('flow-root', 'flow-root', 'Flow root', 'جذر تدفق'),
      opt('none', 'hidden', 'Hidden', 'مخفي'),
    ],
  },
  flexDirection: {
    sector: 'layout',
    control: 'radio',
    labels: L('Direction', 'الاتجاه'),
    quickBar: ['container'],
    options: [
      opt('row', 'flex-row', 'Row', 'صف'),
      opt('row-reverse', 'flex-row-reverse', 'Row reversed', 'صف معكوس'),
      opt('column', 'flex-col', 'Column', 'عمود'),
      opt('column-reverse', 'flex-col-reverse', 'Column reversed', 'عمود معكوس'),
    ],
  },
  flexWrap: {
    sector: 'layout',
    control: 'radio',
    labels: L('Wrap', 'الالتفاف'),
    options: [
      opt('wrap', 'flex-wrap', 'Wrap', 'التفاف'),
      opt('wrap-reverse', 'flex-wrap-reverse', 'Wrap reversed', 'التفاف معكوس'),
      opt('nowrap', 'flex-nowrap', 'No wrap', 'بلا التفاف'),
    ],
  },
  justifyContent: {
    sector: 'layout',
    control: 'radio',
    labels: L('Justify', 'المحاذاة الأفقية'),
    quickBar: ['container'],
    options: prefixed('justify', [
      ['start', 'Start', 'البداية'],
      ['center', 'Centre', 'الوسط'],
      ['end', 'End', 'النهاية'],
      ['between', 'Space between', 'توزيع بين'],
      ['around', 'Space around', 'توزيع حول'],
      ['evenly', 'Space evenly', 'توزيع متساوٍ'],
      ['stretch', 'Stretch', 'تمديد'],
      ['normal', 'Normal', 'عادي'],
    ]),
  },
  alignItems: {
    sector: 'layout',
    control: 'radio',
    labels: L('Align items', 'محاذاة العناصر'),
    quickBar: ['container'],
    options: prefixed('items', [
      ['start', 'Start', 'البداية'],
      ['center', 'Centre', 'الوسط'],
      ['end', 'End', 'النهاية'],
      ['stretch', 'Stretch', 'تمديد'],
      ['baseline', 'Baseline', 'خط الأساس'],
    ]),
  },
  alignSelf: {
    sector: 'layout',
    control: 'select',
    labels: L('Align self', 'محاذاة الذات'),
    options: prefixed('self', [
      ['auto', 'Auto', 'تلقائي'],
      ['start', 'Start', 'البداية'],
      ['center', 'Centre', 'الوسط'],
      ['end', 'End', 'النهاية'],
      ['stretch', 'Stretch', 'تمديد'],
      ['baseline', 'Baseline', 'خط الأساس'],
    ]),
  },
  gap: {
    sector: 'layout',
    control: 'number',
    labels: L('Gap', 'الفجوة'),
    quickBar: ['container'],
    prefix: 'gap',
    tokens: 'spacing',
    scale: SPACING_SCALE,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  columnGap: {
    sector: 'layout',
    control: 'number',
    labels: L('Column gap', 'فجوة الأعمدة'),
    prefix: 'gap-x',
    tokens: 'spacing',
    scale: SPACING_SCALE,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  rowGap: {
    sector: 'layout',
    control: 'number',
    labels: L('Row gap', 'فجوة الصفوف'),
    prefix: 'gap-y',
    tokens: 'spacing',
    scale: SPACING_SCALE,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  gridColumns: {
    sector: 'layout',
    control: 'number',
    labels: L('Grid columns', 'أعمدة الشبكة'),
    prefix: 'grid-cols',
    tokens: 'number',
    scale: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'none', 'subgrid'],
    raw: 'any',
    range: { min: 1, max: 12, step: 1 },
  },
  gridRows: {
    sector: 'layout',
    control: 'number',
    labels: L('Grid rows', 'صفوف الشبكة'),
    prefix: 'grid-rows',
    tokens: 'number',
    scale: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'none', 'subgrid'],
    raw: 'any',
    range: { min: 1, max: 12, step: 1 },
  },
  columnSpan: {
    sector: 'layout',
    control: 'number',
    labels: L('Column span', 'امتداد الأعمدة'),
    prefix: 'col-span',
    tokens: 'number',
    scale: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'full'],
    raw: 'any',
    range: { min: 1, max: 12, step: 1 },
  },
  order: {
    sector: 'layout',
    control: 'number',
    labels: L('Order', 'الترتيب'),
    prefix: 'order',
    tokens: 'number',
    scale: ['first', 'last', 'none', '1', '2', '3', '4', '5', '6'],
    negative: true,
    raw: 'number',
  },
  placeItems: {
    sector: 'layout',
    control: 'select',
    labels: L('Place items', 'تموضع العناصر'),
    options: prefixed('place-items', [
      ['start', 'Start', 'البداية'],
      ['center', 'Centre', 'الوسط'],
      ['end', 'End', 'النهاية'],
      ['stretch', 'Stretch', 'تمديد'],
      ['baseline', 'Baseline', 'خط الأساس'],
    ]),
  },

  // ── Spacing ──
  padding: {
    sector: 'spacing',
    control: 'composite',
    labels: L('Padding', 'الحشوة الداخلية'),
    quickBar: ['container'],
    sides: 'box',
    sidePrefixes: boxPrefixes('p', 'py', 'px', 'pbs', 'pbe', 'ps', 'pe', {
      pt: { reads: 'block-start', overlaps: ['block-start'] },
      pb: { reads: 'block-end', overlaps: ['block-end'] },
      pl: { overlaps: INLINE_PAIR },
      pr: { overlaps: INLINE_PAIR },
    }),
    tokens: 'spacing',
    scale: SPACING_SCALE,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  margin: {
    sector: 'spacing',
    control: 'composite',
    labels: L('Margin', 'الهامش الخارجي'),
    sides: 'box',
    sidePrefixes: boxPrefixes('m', 'my', 'mx', 'mbs', 'mbe', 'ms', 'me', {
      mt: { reads: 'block-start', overlaps: ['block-start'] },
      mb: { reads: 'block-end', overlaps: ['block-end'] },
      ml: { overlaps: INLINE_PAIR },
      mr: { overlaps: INLINE_PAIR },
    }),
    tokens: 'spacing',
    scale: ['auto', ...SPACING_SCALE],
    negative: true,
    raw: 'length',
    units: LENGTH_UNITS,
  },

  // ── Size ──
  inlineSize: {
    sector: 'size',
    control: 'number',
    labels: L('Width (inline size)', 'العرض'),
    prefix: 'inline',
    aliases: ['w'],
    shorthand: { prefix: 'size', counterpart: 'block' },
    tokens: 'inline-size',
    scale: [...SIZE_KEYWORDS, 'screen', '1/2', '1/3', '2/3', '1/4', '3/4', ...SPACING_SCALE],
    raw: 'length',
    units: LENGTH_UNITS,
  },
  blockSize: {
    sector: 'size',
    control: 'number',
    labels: L('Height (block size)', 'الارتفاع'),
    prefix: 'block',
    aliases: ['h'],
    shorthand: { prefix: 'size', counterpart: 'inline' },
    tokens: 'block-size',
    scale: [...SIZE_KEYWORDS, 'screen', 'dvh', 'svh', 'lh', ...SPACING_SCALE],
    raw: 'length',
    units: LENGTH_UNITS,
  },
  minInlineSize: {
    sector: 'size',
    control: 'number',
    labels: L('Min width', 'أدنى عرض'),
    prefix: 'min-inline',
    aliases: ['min-w'],
    tokens: 'inline-size',
    scale: ['0', ...SIZE_KEYWORDS],
    raw: 'length',
    units: LENGTH_UNITS,
  },
  maxInlineSize: {
    sector: 'size',
    control: 'number',
    labels: L('Max width', 'أقصى عرض'),
    prefix: 'max-inline',
    aliases: ['max-w'],
    tokens: 'inline-size',
    scale: [
      'none',
      'content-narrow',
      'content-standard',
      'content-wide',
      'page',
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
      '3xl',
      '4xl',
      '5xl',
      '6xl',
      '7xl',
      'full',
    ],
    raw: 'length',
    units: LENGTH_UNITS,
  },
  minBlockSize: {
    sector: 'size',
    control: 'number',
    labels: L('Min height', 'أدنى ارتفاع'),
    prefix: 'min-block',
    aliases: ['min-h'],
    tokens: 'block-size',
    scale: ['0', 'full', 'screen', 'dvh', 'svh', 'fit'],
    raw: 'length',
    units: LENGTH_UNITS,
  },
  maxBlockSize: {
    sector: 'size',
    control: 'number',
    labels: L('Max height', 'أقصى ارتفاع'),
    prefix: 'max-block',
    aliases: ['max-h'],
    tokens: 'block-size',
    scale: ['none', 'full', 'screen', 'dvh', 'svh', 'fit'],
    raw: 'length',
    units: LENGTH_UNITS,
  },
  aspectRatio: {
    sector: 'size',
    control: 'select',
    labels: L('Aspect ratio', 'نسبة الأبعاد'),
    quickBar: ['media'],
    prefix: 'aspect',
    tokens: 'list',
    scale: ['auto', 'square', 'video', '4/3', '3/2', '3/4', '2/3', '16/9', '9/16', '21/9'],
    raw: 'any',
  },
  overflowInline: {
    sector: 'size',
    control: 'radio',
    labels: L('Overflow (inline)', 'الفائض أفقياً'),
    shorthand: { prefix: 'overflow', counterpart: 'overflow-y' },
    options: prefixed('overflow-x', [
      ['visible', 'Visible', 'ظاهر'],
      ['hidden', 'Hidden', 'مخفي'],
      ['clip', 'Clip', 'قص'],
      ['auto', 'Auto', 'تلقائي'],
      ['scroll', 'Scroll', 'تمرير'],
    ]),
  },
  overflowBlock: {
    sector: 'size',
    control: 'radio',
    labels: L('Overflow (block)', 'الفائض عمودياً'),
    shorthand: { prefix: 'overflow', counterpart: 'overflow-x' },
    options: prefixed('overflow-y', [
      ['visible', 'Visible', 'ظاهر'],
      ['hidden', 'Hidden', 'مخفي'],
      ['clip', 'Clip', 'قص'],
      ['auto', 'Auto', 'تلقائي'],
      ['scroll', 'Scroll', 'تمرير'],
    ]),
  },
  objectFit: {
    sector: 'size',
    control: 'select',
    labels: L('Object fit', 'ملاءمة الوسائط'),
    quickBar: ['media'],
    options: prefixed('object', [
      ['cover', 'Cover', 'تغطية'],
      ['contain', 'Contain', 'احتواء'],
      ['fill', 'Fill', 'ملء'],
      ['none', 'None', 'بدون'],
      ['scale-down', 'Scale down', 'تصغير'],
    ]),
  },
  objectPosition: {
    sector: 'size',
    control: 'select',
    labels: L('Object position', 'موضع الوسائط'),
    prefix: 'object',
    raw: 'any',
    options: [
      ...prefixed('object', [
        ['center', 'Centre', 'الوسط'],
        ['top', 'Top', 'الأعلى'],
        ['bottom', 'Bottom', 'الأسفل'],
        ['left', 'Left', 'اليسار'],
        ['right', 'Right', 'اليمين'],
        ['top-left', 'Top left', 'أعلى اليسار'],
        ['top-right', 'Top right', 'أعلى اليمين'],
        ['bottom-left', 'Bottom left', 'أسفل اليسار'],
        ['bottom-right', 'Bottom right', 'أسفل اليمين'],
      ]),
      legacy('left-top', 'object-left-top'),
      legacy('right-top', 'object-right-top'),
      legacy('left-bottom', 'object-left-bottom'),
      legacy('right-bottom', 'object-right-bottom'),
    ],
  },

  // ── Position ──
  position: {
    sector: 'position',
    control: 'radio',
    labels: L('Position', 'التموضع'),
    options: [
      opt('static', 'static', 'Static', 'ثابت في التدفق'),
      opt('relative', 'relative', 'Relative', 'نسبي'),
      opt('absolute', 'absolute', 'Absolute', 'مطلق'),
      opt('fixed', 'fixed', 'Fixed', 'مثبت'),
      opt('sticky', 'sticky', 'Sticky', 'لاصق'),
    ],
  },
  inset: {
    sector: 'position',
    control: 'composite',
    labels: L('Inset', 'الإزاحة'),
    sides: 'box',
    sidePrefixes: boxPrefixes(
      'inset',
      'inset-y',
      'inset-x',
      'inset-bs',
      'inset-be',
      'inset-s',
      'inset-e',
      {
        top: { reads: 'block-start', overlaps: ['block-start'] },
        bottom: { reads: 'block-end', overlaps: ['block-end'] },
        start: { reads: 'inline-start', overlaps: ['inline-start'] },
        end: { reads: 'inline-end', overlaps: ['inline-end'] },
        left: { overlaps: INLINE_PAIR },
        right: { overlaps: INLINE_PAIR },
      },
    ),
    tokens: 'inline-size',
    scale: ['auto', '0', 'px', '1/2', 'full', ...SPACING_SCALE.slice(2)],
    negative: true,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  zIndex: {
    sector: 'position',
    control: 'number',
    labels: L('Stack order (z-index)', 'ترتيب الطبقات'),
    prefix: 'z',
    tokens: 'number',
    scale: ['auto', '0', '10', '20', '30', '40', '50'],
    negative: true,
    raw: 'number',
  },

  // ── Typography ──
  fontFamily: {
    sector: 'typography',
    control: 'select',
    labels: L('Font', 'الخط'),
    quickBar: ['text'],
    prefix: 'font',
    tokens: 'list',
    scale: ['sans', 'serif', 'mono'],
    raw: 'family',
  },
  fontSize: {
    sector: 'typography',
    control: 'number',
    labels: L('Size', 'الحجم'),
    quickBar: ['text'],
    prefix: 'text',
    tokens: 'list',
    scale: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'],
    raw: 'length',
    units: ['px', 'rem', 'em', 'vw', 'cqi'],
  },
  fontWeight: {
    sector: 'typography',
    control: 'select',
    labels: L('Weight', 'السماكة'),
    quickBar: ['text'],
    prefix: 'font',
    tokens: 'list',
    scale: [
      'thin',
      'extralight',
      'light',
      'normal',
      'regular',
      'medium',
      'semibold',
      'bold',
      'extrabold',
      'black',
    ],
    raw: 'number',
  },
  lineHeight: {
    sector: 'typography',
    control: 'number',
    labels: L('Line height', 'ارتفاع السطر'),
    quickBar: ['text'],
    prefix: 'leading',
    tokens: 'number',
    scale: ['none', 'tight', 'snug', 'normal', 'relaxed', 'loose'],
    raw: 'any',
    units: ['', 'px', 'rem', 'em', '%'],
  },
  letterSpacing: {
    sector: 'typography',
    control: 'slider',
    labels: L('Letter spacing', 'تباعد الحروف'),
    prefix: 'tracking',
    tokens: 'list',
    scale: ['tighter', 'tight', 'normal', 'wide', 'wider', 'widest'],
    raw: 'length',
    units: ['em', 'px'],
    range: { min: -0.1, max: 0.5, step: 0.01 },
  },
  textColor: {
    sector: 'typography',
    control: 'color',
    labels: L('Text colour', 'لون النص'),
    quickBar: ['text', 'link', 'icon'],
    prefix: 'text',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  textAlign: {
    sector: 'typography',
    control: 'radio',
    labels: L('Align', 'المحاذاة'),
    quickBar: ['text'],
    options: [
      opt('start', 'text-start', 'Start', 'البداية'),
      opt('center', 'text-center', 'Centre', 'الوسط'),
      opt('end', 'text-end', 'End', 'النهاية'),
      opt('justify', 'text-justify', 'Justify', 'ضبط'),
      legacy('left', 'text-left'),
      legacy('right', 'text-right'),
    ],
  },
  textTransform: {
    sector: 'typography',
    control: 'radio',
    labels: L('Transform', 'تحويل الأحرف'),
    options: [
      opt('uppercase', 'uppercase', 'Uppercase', 'أحرف كبيرة'),
      opt('lowercase', 'lowercase', 'Lowercase', 'أحرف صغيرة'),
      opt('capitalize', 'capitalize', 'Capitalise', 'أول حرف كبير'),
      opt('none', 'normal-case', 'None', 'بدون'),
    ],
  },
  textDecorationLine: {
    sector: 'typography',
    control: 'radio',
    labels: L('Decoration', 'الزخرفة'),
    options: [
      opt('underline', 'underline', 'Underline', 'تسطير'),
      opt('overline', 'overline', 'Overline', 'خط علوي'),
      opt('line-through', 'line-through', 'Strike-through', 'يتوسطه خط'),
      opt('none', 'no-underline', 'None', 'بدون'),
    ],
  },
  textDecorationStyle: {
    sector: 'typography',
    control: 'select',
    labels: L('Decoration style', 'نمط الزخرفة'),
    options: prefixed('decoration', [
      ['solid', 'Solid', 'متصل'],
      ['double', 'Double', 'مزدوج'],
      ['dotted', 'Dotted', 'منقط'],
      ['dashed', 'Dashed', 'متقطع'],
      ['wavy', 'Wavy', 'متموج'],
    ]),
  },
  textDecorationColor: {
    sector: 'typography',
    control: 'color',
    labels: L('Decoration colour', 'لون الزخرفة'),
    prefix: 'decoration',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  textDecorationThickness: {
    sector: 'typography',
    control: 'number',
    labels: L('Decoration thickness', 'سماكة الزخرفة'),
    prefix: 'decoration',
    tokens: 'number',
    scale: ['auto', 'from-font', '0', '1', '2', '4', '8'],
    raw: 'length',
    units: ['px', 'em'],
  },
  underlineOffset: {
    sector: 'typography',
    control: 'number',
    labels: L('Underline offset', 'إزاحة التسطير'),
    prefix: 'underline-offset',
    tokens: 'number',
    scale: ['auto', '0', '1', '2', '4', '8'],
    raw: 'length',
    units: ['px', 'em'],
  },
  fontStyle: {
    sector: 'typography',
    control: 'radio',
    labels: L('Italic', 'مائل'),
    options: [
      opt('italic', 'italic', 'Italic', 'مائل'),
      opt('normal', 'not-italic', 'Upright', 'مستقيم'),
    ],
  },
  textWrap: {
    sector: 'typography',
    control: 'radio',
    labels: L('Text wrap', 'التفاف النص'),
    options: [
      opt('wrap', 'text-wrap', 'Wrap', 'التفاف'),
      opt('nowrap', 'text-nowrap', 'No wrap', 'بلا التفاف'),
      opt('balance', 'text-balance', 'Balance', 'متوازن'),
      opt('pretty', 'text-pretty', 'Pretty', 'منسق'),
    ],
  },
  whiteSpace: {
    sector: 'typography',
    control: 'select',
    labels: L('White space', 'المسافات البيضاء'),
    options: prefixed('whitespace', [
      ['normal', 'Normal', 'عادي'],
      ['nowrap', 'No wrap', 'بلا التفاف'],
      ['pre', 'Preserve', 'كما هي'],
      ['pre-line', 'Preserve lines', 'حفظ الأسطر'],
      ['pre-wrap', 'Preserve and wrap', 'حفظ مع التفاف'],
      ['break-spaces', 'Break spaces', 'كسر المسافات'],
    ]),
  },
  textShadow: {
    sector: 'typography',
    control: 'stack',
    labels: L('Text shadow', 'ظل النص'),
    prefix: 'text-shadow',
    tokens: 'list',
    scale: ['none', '2xs', 'xs', 'sm', 'md', 'lg'],
    raw: 'shadow',
  },
  listStyle: {
    sector: 'typography',
    control: 'select',
    labels: L('List style', 'نمط القائمة'),
    options: prefixed('list', [
      ['none', 'None', 'بدون'],
      ['disc', 'Bullets', 'نقاط'],
      ['decimal', 'Numbers', 'أرقام'],
    ]),
  },
  textOverflow: {
    sector: 'typography',
    control: 'select',
    labels: L('Truncate', 'الاقتطاع'),
    options: [
      opt('truncate', 'truncate', 'Truncate one line', 'اقتطاع سطر واحد'),
      opt('ellipsis', 'text-ellipsis', 'Ellipsis', 'نقاط حذف'),
      opt('clip', 'text-clip', 'Clip', 'قص'),
    ],
  },
  lineClamp: {
    sector: 'typography',
    control: 'number',
    labels: L('Line clamp', 'حد الأسطر'),
    prefix: 'line-clamp',
    tokens: 'number',
    scale: ['none', '1', '2', '3', '4', '5', '6'],
    raw: 'number',
    range: { min: 1, max: 12, step: 1 },
  },

  // ── Backgrounds ──
  backgroundColor: {
    sector: 'backgrounds',
    control: 'color',
    labels: L('Background colour', 'لون الخلفية'),
    quickBar: ['container'],
    prefix: 'bg',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  gradientDirection: {
    sector: 'backgrounds',
    control: 'composite',
    group: 'gradient',
    labels: L('Gradient', 'التدرج'),
    prefix: 'bg-linear',
    tokens: 'number',
    raw: 'any',
    units: ANGLE_UNITS,
    options: [
      opt('to-block-start', 'bg-linear-to-t', 'Towards the top', 'نحو الأعلى'),
      opt('to-block-end', 'bg-linear-to-b', 'Towards the bottom', 'نحو الأسفل'),
      opt(
        'to-inline-start',
        'bg-linear-to-l rtl:bg-linear-to-r',
        'Towards the start',
        'نحو البداية',
      ),
      opt('to-inline-end', 'bg-linear-to-r rtl:bg-linear-to-l', 'Towards the end', 'نحو النهاية'),
      opt(
        'to-block-start-inline-start',
        'bg-linear-to-tl rtl:bg-linear-to-tr',
        'Towards top start',
        'نحو أعلى البداية',
      ),
      opt(
        'to-block-start-inline-end',
        'bg-linear-to-tr rtl:bg-linear-to-tl',
        'Towards top end',
        'نحو أعلى النهاية',
      ),
      opt(
        'to-block-end-inline-start',
        'bg-linear-to-bl rtl:bg-linear-to-br',
        'Towards bottom start',
        'نحو أسفل البداية',
      ),
      opt(
        'to-block-end-inline-end',
        'bg-linear-to-br rtl:bg-linear-to-bl',
        'Towards bottom end',
        'نحو أسفل النهاية',
      ),
      opt('radial', 'bg-radial', 'Radial', 'شعاعي'),
      opt('conic', 'bg-conic', 'Conic', 'مخروطي'),
      // Tailwind v3 spelling, still generated and in the static vocabulary.
      ...['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl'].map((to) =>
        legacy(`gradient-to-${to}`, `bg-gradient-to-${to}`),
      ),
    ],
  },
  gradientFrom: {
    sector: 'backgrounds',
    control: 'color',
    group: 'gradient',
    labels: L('Gradient start colour', 'لون بداية التدرج'),
    prefix: 'from',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  gradientVia: {
    sector: 'backgrounds',
    control: 'color',
    group: 'gradient',
    labels: L('Gradient middle colour', 'لون وسط التدرج'),
    prefix: 'via',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  gradientTo: {
    sector: 'backgrounds',
    control: 'color',
    group: 'gradient',
    labels: L('Gradient end colour', 'لون نهاية التدرج'),
    prefix: 'to',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  backgroundImage: {
    sector: 'backgrounds',
    control: 'text',
    labels: L('Background image', 'صورة الخلفية'),
    prefix: 'bg',
    raw: 'image',
    options: [opt('none', 'bg-none', 'None', 'بدون')],
  },
  backgroundSize: {
    sector: 'backgrounds',
    control: 'select',
    labels: L('Background size', 'حجم الخلفية'),
    prefix: 'bg-size',
    raw: 'any',
    options: [
      opt('auto', 'bg-auto', 'Auto', 'تلقائي'),
      opt('cover', 'bg-cover', 'Cover', 'تغطية'),
      opt('contain', 'bg-contain', 'Contain', 'احتواء'),
    ],
  },
  backgroundPosition: {
    sector: 'backgrounds',
    control: 'select',
    labels: L('Background position', 'موضع الخلفية'),
    prefix: 'bg-position',
    raw: 'any',
    options: [
      ...prefixed('bg', [
        ['center', 'Centre', 'الوسط'],
        ['top', 'Top', 'الأعلى'],
        ['bottom', 'Bottom', 'الأسفل'],
        ['left', 'Left', 'اليسار'],
        ['right', 'Right', 'اليمين'],
        ['top-left', 'Top left', 'أعلى اليسار'],
        ['top-right', 'Top right', 'أعلى اليمين'],
        ['bottom-left', 'Bottom left', 'أسفل اليسار'],
        ['bottom-right', 'Bottom right', 'أسفل اليمين'],
      ]),
      legacy('left-top', 'bg-left-top'),
      legacy('right-top', 'bg-right-top'),
      legacy('left-bottom', 'bg-left-bottom'),
      legacy('right-bottom', 'bg-right-bottom'),
    ],
  },
  backgroundRepeat: {
    sector: 'backgrounds',
    control: 'select',
    labels: L('Background repeat', 'تكرار الخلفية'),
    options: [
      opt('repeat', 'bg-repeat', 'Repeat', 'تكرار'),
      opt('no-repeat', 'bg-no-repeat', 'No repeat', 'بلا تكرار'),
      opt('repeat-x', 'bg-repeat-x', 'Repeat across', 'تكرار أفقي'),
      opt('repeat-y', 'bg-repeat-y', 'Repeat down', 'تكرار عمودي'),
      opt('round', 'bg-repeat-round', 'Round', 'تقريب'),
      opt('space', 'bg-repeat-space', 'Space', 'تباعد'),
    ],
  },
  backgroundAttachment: {
    sector: 'backgrounds',
    control: 'radio',
    labels: L('Background attachment', 'تثبيت الخلفية'),
    options: [
      opt('scroll', 'bg-scroll', 'Scroll', 'مع التمرير'),
      opt('fixed', 'bg-fixed', 'Fixed', 'ثابتة'),
      opt('local', 'bg-local', 'Local', 'محلية'),
    ],
  },
  backgroundClip: {
    sector: 'backgrounds',
    control: 'select',
    labels: L('Background clip', 'قص الخلفية'),
    options: [
      opt('border', 'bg-clip-border', 'Border box', 'حتى الحد'),
      opt('padding', 'bg-clip-padding', 'Padding box', 'حتى الحشوة'),
      opt('content', 'bg-clip-content', 'Content box', 'حتى المحتوى'),
      opt('text', 'bg-clip-text', 'Text (gradient text)', 'النص (نص متدرج)'),
    ],
  },

  // ── Borders ──
  borderWidth: {
    sector: 'borders',
    control: 'composite',
    labels: L('Border width', 'سماكة الحد'),
    quickBar: ['container'],
    sides: 'box',
    sidePrefixes: boxPrefixes(
      'border',
      'border-y',
      'border-x',
      'border-bs',
      'border-be',
      'border-s',
      'border-e',
      {
        'border-t': { reads: 'block-start', overlaps: ['block-start'] },
        'border-b': { reads: 'block-end', overlaps: ['block-end'] },
        'border-l': { overlaps: INLINE_PAIR },
        'border-r': { overlaps: INLINE_PAIR },
      },
    ),
    bare: 'default',
    tokens: 'number',
    scale: ['0', 'default', '2', '4', '8'],
    raw: 'length',
    units: ['px'],
  },
  borderStyle: {
    sector: 'borders',
    control: 'select',
    labels: L('Border style', 'نمط الحد'),
    options: prefixed('border', [
      ['solid', 'Solid', 'متصل'],
      ['dashed', 'Dashed', 'متقطع'],
      ['dotted', 'Dotted', 'منقط'],
      ['double', 'Double', 'مزدوج'],
      ['hidden', 'Hidden', 'مخفي'],
      ['none', 'None', 'بدون'],
    ]),
  },
  borderColor: {
    sector: 'borders',
    control: 'color',
    labels: L('Border colour', 'لون الحد'),
    prefix: 'border',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  borderRadius: {
    sector: 'borders',
    control: 'composite',
    labels: L('Corner radius', 'استدارة الزوايا'),
    quickBar: ['container', 'media'],
    sides: 'corners',
    sidePrefixes: {
      logical: {
        all: 'rounded',
        'inline-start': 'rounded-s',
        'inline-end': 'rounded-e',
        'block-start': 'rounded-t',
        'block-end': 'rounded-b',
        'start-start': 'rounded-ss',
        'start-end': 'rounded-se',
        'end-start': 'rounded-es',
        'end-end': 'rounded-ee',
      },
      physical: {
        'rounded-l': { overlaps: ALL_CORNERS },
        'rounded-r': { overlaps: ALL_CORNERS },
        'rounded-tl': { overlaps: TOP_ROW },
        'rounded-tr': { overlaps: TOP_ROW },
        'rounded-bl': { overlaps: BOTTOM_ROW },
        'rounded-br': { overlaps: BOTTOM_ROW },
      },
    },
    bare: 'default',
    tokens: 'list',
    scale: RADIUS_SCALE,
    raw: 'length',
    units: ['px', 'rem', '%'],
  },
  outlineWidth: {
    sector: 'borders',
    control: 'number',
    labels: L('Outline width', 'سماكة الإطار الخارجي'),
    prefix: 'outline',
    bare: 'default',
    tokens: 'number',
    scale: ['0', 'default', '1', '2', '4', '8'],
    raw: 'length',
    units: ['px'],
  },
  outlineStyle: {
    sector: 'borders',
    control: 'select',
    labels: L('Outline style', 'نمط الإطار الخارجي'),
    options: prefixed('outline', [
      ['solid', 'Solid', 'متصل'],
      ['dashed', 'Dashed', 'متقطع'],
      ['dotted', 'Dotted', 'منقط'],
      ['double', 'Double', 'مزدوج'],
      ['none', 'None', 'بدون'],
      ['hidden', 'Hidden', 'مخفي'],
    ]),
  },
  outlineColor: {
    sector: 'borders',
    control: 'color',
    labels: L('Outline colour', 'لون الإطار الخارجي'),
    prefix: 'outline',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },
  outlineOffset: {
    sector: 'borders',
    control: 'number',
    labels: L('Outline offset', 'إزاحة الإطار الخارجي'),
    prefix: 'outline-offset',
    tokens: 'number',
    scale: ['0', '1', '2', '4', '8'],
    negative: true,
    raw: 'length',
    units: ['px'],
  },
  divideInline: {
    sector: 'borders',
    control: 'number',
    labels: L('Dividers between items (inline)', 'فواصل بين العناصر أفقياً'),
    prefix: 'divide-x',
    bare: 'default',
    tokens: 'number',
    scale: ['0', 'default', '2', '4', '8'],
    raw: 'length',
    units: ['px'],
  },
  divideBlock: {
    sector: 'borders',
    control: 'number',
    labels: L('Dividers between items (block)', 'فواصل بين العناصر عمودياً'),
    prefix: 'divide-y',
    bare: 'default',
    tokens: 'number',
    scale: ['0', 'default', '2', '4', '8'],
    raw: 'length',
    units: ['px'],
  },
  divideColor: {
    sector: 'borders',
    control: 'color',
    labels: L('Divider colour', 'لون الفواصل'),
    prefix: 'divide',
    tokens: 'color',
    palette: true,
    raw: 'color',
  },

  // ── Effects ──
  boxShadow: {
    sector: 'effects',
    control: 'stack',
    labels: L('Shadow', 'الظل'),
    quickBar: ['container'],
    prefix: 'shadow',
    bare: 'default',
    tokens: 'list',
    scale: [
      'none',
      'soft',
      'strong',
      'elevated',
      '2xs',
      'xs',
      'sm',
      'default',
      'md',
      'lg',
      'xl',
      '2xl',
    ],
    raw: 'shadow',
  },
  insetShadow: {
    sector: 'effects',
    control: 'stack',
    labels: L('Inner shadow', 'الظل الداخلي'),
    prefix: 'inset-shadow',
    tokens: 'list',
    scale: ['none', '2xs', 'xs', 'sm'],
    raw: 'shadow',
  },
  opacity: {
    sector: 'effects',
    control: 'slider',
    labels: L('Opacity', 'الشفافية'),
    quickBar: ['container', 'media'],
    prefix: 'opacity',
    tokens: 'number',
    scale: [
      '0',
      '5',
      '10',
      '20',
      '25',
      '30',
      '40',
      '50',
      '60',
      '70',
      '75',
      '80',
      '90',
      '95',
      '100',
    ],
    raw: 'number',
    range: { min: 0, max: 100, step: 5 },
  },
  blur: {
    sector: 'effects',
    control: 'slider',
    labels: L('Blur', 'التمويه'),
    prefix: 'blur',
    tokens: 'list',
    scale: BLUR_SCALE,
    raw: 'length',
    units: ['px'],
  },
  backdropBlur: {
    sector: 'effects',
    control: 'slider',
    labels: L('Backdrop blur', 'تمويه ما خلف العنصر'),
    prefix: 'backdrop-blur',
    tokens: 'list',
    scale: BLUR_SCALE,
    raw: 'length',
    units: ['px'],
  },
  brightness: {
    sector: 'effects',
    control: 'slider',
    labels: L('Brightness', 'السطوع'),
    prefix: 'brightness',
    tokens: 'number',
    scale: FILTER_PERCENT,
    raw: 'number',
    range: { min: 0, max: 200, step: 5 },
  },
  contrast: {
    sector: 'effects',
    control: 'slider',
    labels: L('Contrast', 'التباين'),
    prefix: 'contrast',
    tokens: 'number',
    scale: FILTER_PERCENT,
    raw: 'number',
    range: { min: 0, max: 200, step: 5 },
  },
  saturate: {
    sector: 'effects',
    control: 'slider',
    labels: L('Saturation', 'التشبع'),
    prefix: 'saturate',
    tokens: 'number',
    scale: FILTER_PERCENT,
    raw: 'number',
    range: { min: 0, max: 200, step: 5 },
  },
  grayscale: {
    sector: 'effects',
    control: 'slider',
    labels: L('Greyscale', 'تدرج الرمادي'),
    prefix: 'grayscale',
    bare: 'default',
    tokens: 'number',
    scale: ['0', '25', '50', '75', 'default'],
    raw: 'number',
    range: { min: 0, max: 100, step: 5 },
  },
  hueRotate: {
    sector: 'effects',
    control: 'slider',
    labels: L('Hue rotate', 'تدوير درجة اللون'),
    prefix: 'hue-rotate',
    tokens: 'number',
    scale: ['0', '15', '30', '60', '90', '180'],
    negative: true,
    raw: 'any',
    units: ANGLE_UNITS,
    range: { min: -180, max: 180, step: 5 },
  },
  mixBlend: {
    sector: 'effects',
    control: 'select',
    labels: L('Blend mode', 'وضع المزج'),
    options: prefixed('mix-blend', [
      ['normal', 'Normal', 'عادي'],
      ['multiply', 'Multiply', 'ضرب'],
      ['screen', 'Screen', 'شاشة'],
      ['overlay', 'Overlay', 'تراكب'],
      ['darken', 'Darken', 'تغميق'],
      ['lighten', 'Lighten', 'تفتيح'],
      ['color-dodge', 'Colour dodge', 'تفادي اللون'],
      ['color-burn', 'Colour burn', 'حرق اللون'],
      ['hard-light', 'Hard light', 'ضوء قوي'],
      ['soft-light', 'Soft light', 'ضوء ناعم'],
      ['difference', 'Difference', 'فرق'],
      ['exclusion', 'Exclusion', 'استبعاد'],
      ['hue', 'Hue', 'درجة اللون'],
      ['saturation', 'Saturation', 'التشبع'],
      ['color', 'Colour', 'اللون'],
      ['luminosity', 'Luminosity', 'الإضاءة'],
    ]),
  },
  mask: {
    sector: 'effects',
    control: 'select',
    labels: L('Mask', 'القناع'),
    prefix: 'mask',
    raw: 'image',
    options: [
      opt('none', 'mask-none', 'None', 'بدون'),
      opt('fade-block-end', 'mask-b-from-60%', 'Fade out at the bottom', 'تلاشٍ في الأسفل'),
      opt('fade-block-start', 'mask-t-from-60%', 'Fade out at the top', 'تلاشٍ في الأعلى'),
      opt('fade-block', 'mask-y-from-70%', 'Fade out top and bottom', 'تلاشٍ أعلى وأسفل'),
      opt('fade-inline', 'mask-x-from-80%', 'Fade out at both sides', 'تلاشٍ على الجانبين'),
      opt('fade-radial', 'mask-radial-from-40%', 'Fade out around the edge', 'تلاشٍ دائري'),
    ],
  },
  effects: {
    sector: 'effects',
    control: 'keyword',
    labels: L('Effect presets', 'مؤثرات جاهزة'),
    baseOnly: true,
    multi: true,
    options: [
      opt('glass', 'ck-fx-glass', 'Glass', 'زجاجي'),
      opt('mesh', 'ck-fx-mesh', 'Mesh gradient', 'تدرج شبكي'),
      opt('noise', 'ck-fx-noise', 'Noise', 'حبيبات'),
      opt('grid', 'ck-fx-grid', 'Grid pattern', 'نقش شبكي'),
      opt('dots', 'ck-fx-dots', 'Dot pattern', 'نقش منقط'),
      opt('retro-grid', 'ck-fx-retro-grid', 'Retro grid', 'شبكة كلاسيكية'),
      opt('spotlight', 'ck-fx-spotlight', 'Spotlight', 'بقعة ضوء'),
      opt('gradient-border', 'ck-fx-gradient-border', 'Gradient border', 'حد متدرج'),
      opt('aurora-bg', 'ck-fx-aurora-bg', 'Aurora', 'شفق'),
      opt('text-gradient', 'ck-fx-text-gradient', 'Gradient text', 'نص متدرج'),
      opt('ring-glow', 'ck-fx-ring-glow', 'Ring glow', 'توهج الحلقة'),
    ],
  },

  // ── Transforms ──
  translateInline: {
    sector: 'transforms',
    control: 'number',
    labels: L('Move across', 'إزاحة أفقية'),
    prefix: 'translate-x',
    tokens: 'inline-size',
    scale: ['0', 'px', '1', '2', '4', '8', '1/2', 'full'],
    negative: true,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  translateBlock: {
    sector: 'transforms',
    control: 'number',
    labels: L('Move down', 'إزاحة عمودية'),
    prefix: 'translate-y',
    tokens: 'inline-size',
    scale: ['0', 'px', '1', '2', '4', '8', '1/2', 'full'],
    negative: true,
    raw: 'length',
    units: LENGTH_UNITS,
  },
  rotate: {
    sector: 'transforms',
    control: 'slider',
    labels: L('Rotate', 'التدوير'),
    prefix: 'rotate',
    tokens: 'number',
    scale: ['0', '1', '2', '3', '6', '12', '45', '90', '180'],
    negative: true,
    raw: 'any',
    units: ANGLE_UNITS,
    range: { min: -180, max: 180, step: 1 },
  },
  scale: {
    sector: 'transforms',
    control: 'slider',
    labels: L('Scale', 'التحجيم'),
    prefix: 'scale',
    tokens: 'number',
    scale: ['0', '50', '75', '90', '95', '100', '105', '110', '125', '150'],
    negative: true,
    raw: 'number',
    range: { min: 0, max: 200, step: 5 },
  },
  skewInline: {
    sector: 'transforms',
    control: 'slider',
    labels: L('Skew across', 'إمالة أفقية'),
    prefix: 'skew-x',
    tokens: 'number',
    scale: ['0', '1', '2', '3', '6', '12'],
    negative: true,
    raw: 'any',
    units: ANGLE_UNITS,
    range: { min: -45, max: 45, step: 1 },
  },
  skewBlock: {
    sector: 'transforms',
    control: 'slider',
    labels: L('Skew down', 'إمالة عمودية'),
    prefix: 'skew-y',
    tokens: 'number',
    scale: ['0', '1', '2', '3', '6', '12'],
    negative: true,
    raw: 'any',
    units: ANGLE_UNITS,
    range: { min: -45, max: 45, step: 1 },
  },
  transformOrigin: {
    sector: 'transforms',
    control: 'select',
    labels: L('Transform origin', 'نقطة الارتكاز'),
    prefix: 'origin',
    raw: 'any',
    options: prefixed('origin', [
      ['center', 'Centre', 'الوسط'],
      ['top', 'Top', 'الأعلى'],
      ['top-right', 'Top right', 'أعلى اليمين'],
      ['right', 'Right', 'اليمين'],
      ['bottom-right', 'Bottom right', 'أسفل اليمين'],
      ['bottom', 'Bottom', 'الأسفل'],
      ['bottom-left', 'Bottom left', 'أسفل اليسار'],
      ['left', 'Left', 'اليسار'],
      ['top-left', 'Top left', 'أعلى اليسار'],
    ]),
  },
  perspective: {
    sector: 'transforms',
    control: 'select',
    labels: L('3D perspective', 'منظور ثلاثي الأبعاد'),
    prefix: 'perspective',
    tokens: 'list',
    scale: ['none', 'dramatic', 'near', 'normal', 'midrange', 'distant'],
    raw: 'length',
    units: ['px', 'rem'],
  },

  // ── Transitions ──
  transitionProperty: {
    sector: 'transitions',
    control: 'select',
    labels: L('Transition', 'الانتقال'),
    options: [
      opt('default', 'transition', 'Common properties', 'الخصائص الشائعة'),
      opt('all', 'transition-all', 'Everything', 'كل شيء'),
      opt('colors', 'transition-colors', 'Colours', 'الألوان'),
      opt('opacity', 'transition-opacity', 'Opacity', 'الشفافية'),
      opt('shadow', 'transition-shadow', 'Shadow', 'الظل'),
      opt('transform', 'transition-transform', 'Transform', 'التحويل'),
      opt('none', 'transition-none', 'None', 'بدون'),
    ],
  },
  transitionDuration: {
    sector: 'transitions',
    control: 'number',
    labels: L('Duration', 'المدة'),
    prefix: 'duration',
    tokens: 'number',
    scale: ['75', '100', '150', '200', '300', '500', '700', '1000'],
    raw: 'any',
    units: TIME_UNITS,
  },
  transitionEasing: {
    sector: 'transitions',
    control: 'select',
    labels: L('Easing', 'التسارع'),
    prefix: 'ease',
    tokens: 'list',
    scale: ['linear', 'in', 'out', 'in-out'],
    raw: 'any',
  },
  transitionDelay: {
    sector: 'transitions',
    control: 'number',
    labels: L('Delay', 'التأخير'),
    prefix: 'delay',
    tokens: 'number',
    scale: ['0', '75', '100', '150', '200', '300', '500', '700', '1000'],
    raw: 'any',
    units: TIME_UNITS,
  },

  // ── Motion & interactions (attributes, §B — not classes) ──
  motion: {
    sector: 'motion',
    control: 'select',
    labels: L('Animation', 'الحركة'),
    storage: 'attribute',
    attribute: 'data-ck-motion',
    optionsFrom: 'custom-code/motion-vocabulary',
  },
  hoverMotion: {
    sector: 'motion',
    control: 'select',
    labels: L('Hover effect', 'تأثير التمرير'),
    quickBar: ['link'],
    storage: 'attribute',
    attribute: 'data-ck-hover',
    optionsFrom: 'custom-code/motion-vocabulary',
  },

  // ── Advanced ──
  direction: {
    sector: 'advanced',
    control: 'radio',
    labels: L('Text direction', 'اتجاه النص'),
    quickBar: ['text'],
    storage: 'attribute',
    attribute: 'dir',
    options: [
      { value: 'auto', className: '', labels: L('Auto', 'تلقائي') },
      { value: 'rtl', className: '', labels: L('Right to left', 'من اليمين إلى اليسار') },
      { value: 'ltr', className: '', labels: L('Left to right', 'من اليسار إلى اليمين') },
    ],
  },
};

function build(id: StylePropertyId): StylePropertyDef {
  const def = DEFS[id];
  return {
    ...def,
    id,
    family: def.family ?? id,
    storage: def.storage ?? 'class',
    quickBar: def.quickBar ?? [],
  };
}

/** Every property, by id. */
export const STYLE_PROPERTIES: Readonly<Record<StylePropertyId, StylePropertyDef>> =
  Object.fromEntries(STYLE_PROPERTY_IDS.map((id) => [id, build(id)])) as Record<
    StylePropertyId,
    StylePropertyDef
  >;

const SECTOR_LABELS: readonly (readonly [StyleSectorId, StyleLabels])[] = [
  ['layout', L('Layout', 'التخطيط')],
  ['spacing', L('Spacing', 'المسافات')],
  ['size', L('Size', 'الحجم')],
  ['position', L('Position', 'التموضع')],
  ['typography', L('Typography', 'الطباعة')],
  ['backgrounds', L('Backgrounds', 'الخلفيات')],
  ['borders', L('Borders', 'الحدود')],
  ['effects', L('Effects', 'المؤثرات')],
  ['transforms', L('Transforms', 'التحويلات')],
  ['transitions', L('Transitions', 'الانتقالات')],
  ['motion', L('Motion & interactions', 'الحركة والتفاعل')],
  ['advanced', L('Advanced', 'متقدم')],
];

/** §A.4 in panel order: sectors, each with its properties. */
export const STYLE_SECTORS: readonly StyleSector[] = SECTOR_LABELS.map(([id, labels]) => ({
  id,
  labels,
  properties: STYLE_PROPERTY_IDS.filter((property) => DEFS[property].sector === id).map(
    (property) => STYLE_PROPERTIES[property],
  ),
}));

/** The sides a sided property's controls offer. */
export function styleSidesOf(property: StylePropertyId): readonly StyleSide[] {
  const def = STYLE_PROPERTIES[property];
  if (def.sides === 'box') return BOX_SIDES;
  if (def.sides === 'corners') {
    return ['all', 'inline-start', 'inline-end', 'block-start', 'block-end', ...ALL_CORNERS];
  }
  return [];
}

/** The properties a quick bar of this element kind carries, in panel order. */
export function quickBarProperties(kind: StyleElementKind): readonly StylePropertyDef[] {
  return STYLE_PROPERTY_IDS.map((id) => STYLE_PROPERTIES[id]).filter((def) =>
    def.quickBar.includes(kind),
  );
}

export function isStylePropertyId(value: string): value is StylePropertyId {
  return (STYLE_PROPERTY_IDS as readonly string[]).includes(value);
}
