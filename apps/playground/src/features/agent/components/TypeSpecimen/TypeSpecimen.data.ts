/**
 * What the specimen shows, as data: the six font files the playground loads (measured)
 * and the SPEC §2.2 type roles (specified). The test holds both to the truth: every byte
 * count must equal the file on disk, and `main.tsx` must import exactly these six
 * stylesheets in this order.
 */

export interface FontFile {
  readonly family: 'IBM Plex Sans' | 'IBM Plex Sans Arabic';
  readonly packageName: '@fontsource/ibm-plex-sans' | '@fontsource/ibm-plex-sans-arabic';
  readonly subset: 'latin' | 'arabic';
  readonly weight: 400 | 500 | 600;
  /** The stylesheet inside the package: one `@font-face`, no `unicode-range`. */
  readonly stylesheet: string;
  /** The import specifier `main.tsx` uses. */
  readonly specifier: string;
  /** The woff2 file the stylesheet points at, in the package's `files/`. */
  readonly file: string;
  /**
   * Bytes on disk, measured 2026-09-28 against fontsource 5.3.0, and equal to the asset
   * `vite build` emits (it copies fonts unchanged). woff2 is already Brotli-compressed, so
   * this is the transfer size too, give or take response headers.
   */
  readonly bytes: number;
}

function fontFile(
  family: FontFile['family'],
  subset: FontFile['subset'],
  weight: FontFile['weight'],
  bytes: number,
): FontFile {
  const packageName =
    family === 'IBM Plex Sans' ? '@fontsource/ibm-plex-sans' : '@fontsource/ibm-plex-sans-arabic';
  const slug = packageName.slice('@fontsource/'.length);
  const stylesheet = `${subset}-${String(weight)}.css`;
  return {
    family,
    packageName,
    subset,
    weight,
    stylesheet,
    specifier: `${packageName}/${stylesheet}`,
    file: `${slug}-${subset}-${String(weight)}-normal.woff2`,
    bytes,
  };
}

export const FONT_FILES: readonly FontFile[] = [
  fontFile('IBM Plex Sans', 'latin', 400, 22_588),
  fontFile('IBM Plex Sans', 'latin', 500, 24_184),
  fontFile('IBM Plex Sans', 'latin', 600, 24_252),
  fontFile('IBM Plex Sans Arabic', 'arabic', 400, 42_848),
  fontFile('IBM Plex Sans Arabic', 'arabic', 500, 45_296),
  fontFile('IBM Plex Sans Arabic', 'arabic', 600, 45_688),
];

/** `22,588 B (22.1 KiB)`: exact bytes first, because the docs page records bytes. */
export function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString('en-US')} B (${(bytes / 1024).toFixed(1)} KiB)`;
}

/* ── SPEC §2.2 roles ─────────────────────────────────────────────────────────── */

export type TypeRoleKey =
  'figure' | 'meta' | 'read' | 'heading' | 'name' | 'input' | 'lead' | 'inputCoarse';

/** A size and line height in px, as SPEC §2.2 writes them: `13 / 20`. */
export interface TypeMetric {
  readonly size: number;
  readonly line: number;
}

export interface TypeRole {
  readonly key: TypeRoleKey;
  /** The role's name, in each locale the specimen is read in. */
  readonly label: { readonly en: string; readonly ar: string };
  /** Where the panel uses it (SPEC §2.2, first column). */
  readonly use: { readonly en: string; readonly ar: string };
  /**
   * The size token pair it reads, by the role's token name (`read` is the font-size and the
   * line-height tokens named `read`). Named without the `--bldr-` prefix on purpose: the
   * theme's coverage test reads every prefixed name in a source file as a token, and a
   * wildcard written after the prefix reported two tokens that do not exist.
   */
  readonly token: 'figure' | 'meta' | 'read' | 'name' | 'input' | 'lead';
  readonly latin: TypeMetric;
  readonly arabic: TypeMetric;
  readonly weight: 400 | 500 | 600;
  readonly tabular: boolean;
  /** The ink SPEC §2.2 gives it; Meta also takes Graphite or Ink in context. */
  readonly ink: 'ink' | 'graphite' | 'slate';
  /** Only a coarse pointer resolves these values; elsewhere the row shows Input's. */
  readonly coarseOnly: boolean;
  readonly sample: { readonly en: string; readonly ar: string };
}

export const TYPE_ROLES: readonly TypeRole[] = [
  {
    key: 'figure',
    label: { en: 'Figure', ar: 'رقم' },
    use: { en: 'Counts, clocks, positions, keys', ar: 'العدّادات والوقت والترتيب والمفاتيح' },
    token: 'figure',
    latin: { size: 11, line: 16 },
    arabic: { size: 12, line: 18 },
    weight: 500,
    tabular: true,
    ink: 'slate',
    coarseOnly: false,
    sample: { en: '4/8 0:41 2:21 1280', ar: '8/8 1:24 0:07 1440' },
  },
  {
    key: 'meta',
    label: { en: 'Meta', ar: 'وصفي' },
    use: { en: 'Captions, state words, times', ar: 'التعليقات وكلمات الحالة والأوقات' },
    token: 'meta',
    latin: { size: 12, line: 16 },
    arabic: { size: 13, line: 20 },
    weight: 400,
    tabular: false,
    ink: 'slate',
    coarseOnly: false,
    sample: { en: 'Writing 2 sections, 2 minutes ago', ar: 'يكتب قسمين، قبل دقيقتين' },
  },
  {
    key: 'read',
    label: { en: 'Read', ar: 'قراءة' },
    use: { en: 'Rows, bubbles, change lines, prose', ar: 'الصفوف والفقاعات وأسطر التغيير والنصوص' },
    token: 'read',
    latin: { size: 13, line: 20 },
    arabic: { size: 14, line: 22 },
    weight: 400,
    tabular: false,
    ink: 'ink',
    coarseOnly: false,
    sample: {
      en: 'A dark hero with a WhatsApp button',
      ar: 'قسم رئيسي داكن مع زر واتساب',
    },
  },
  {
    key: 'heading',
    label: { en: 'Heading', ar: 'عنوان' },
    use: { en: 'Record and card titles', ar: 'عناوين السجلات والبطاقات' },
    token: 'read',
    latin: { size: 13, line: 20 },
    arabic: { size: 14, line: 22 },
    weight: 600,
    tabular: false,
    ink: 'ink',
    coarseOnly: false,
    sample: { en: 'Page built', ar: 'بُنيت الصفحة' },
  },
  {
    key: 'name',
    label: { en: 'Name', ar: 'اسم' },
    use: { en: 'The panel header', ar: 'ترويسة اللوحة' },
    token: 'name',
    latin: { size: 14, line: 20 },
    arabic: { size: 15, line: 22 },
    weight: 600,
    tabular: false,
    ink: 'ink',
    coarseOnly: false,
    sample: { en: 'Abu Ghadab', ar: 'أبو غضب' },
  },
  {
    key: 'input',
    label: { en: 'Input', ar: 'إدخال' },
    use: { en: 'Composer, inline rename', ar: 'مربع الكتابة وإعادة التسمية' },
    token: 'input',
    latin: { size: 14, line: 20 },
    arabic: { size: 15, line: 24 },
    weight: 400,
    tabular: false,
    ink: 'ink',
    coarseOnly: false,
    sample: {
      en: 'Add pricing and a map to the contact section',
      ar: 'أضف الأسعار وخريطة إلى قسم التواصل',
    },
  },
  {
    key: 'lead',
    label: { en: 'Lead', ar: 'افتتاحية' },
    use: { en: 'The empty-state greeting', ar: 'تحية الحالة الفارغة' },
    token: 'lead',
    latin: { size: 16, line: 24 },
    arabic: { size: 18, line: 30 },
    weight: 500,
    tabular: false,
    ink: 'ink',
    coarseOnly: false,
    sample: { en: 'What are we building today?', ar: 'شو بدنا نبني اليوم؟' },
  },
  {
    key: 'inputCoarse',
    label: { en: 'Input, coarse pointer', ar: 'إدخال باللمس' },
    use: { en: 'Composer on a touch screen', ar: 'مربع الكتابة على شاشة لمس' },
    token: 'input',
    latin: { size: 16, line: 24 },
    arabic: { size: 16, line: 26 },
    weight: 400,
    tabular: false,
    ink: 'ink',
    coarseOnly: true,
    sample: { en: 'Make the footer darker', ar: 'اجعل التذييل أغمق' },
  },
];

/* ── Figures ─────────────────────────────────────────────────────────────────── */

/**
 * Two groups of same-length figures, as unequal as digits get: `1` is the narrowest
 * glyph in a proportional face and `0`/`8` among the widest. Set tabular, each group is
 * one width, which is what keeps a ticking clock or a growing count from jittering.
 */
export const FIGURE_GROUPS: readonly (readonly string[])[] = [
  ['1:11', '0:07', '8:48'],
  ['1/8', '4/8', '8/8'],
];
