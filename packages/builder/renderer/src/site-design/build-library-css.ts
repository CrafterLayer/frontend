import {
  CUSTOM_CSS_FONT_HOSTS,
  paletteColorSchema,
  paletteVariable,
  siteFontSchema,
  type SiteFont,
  type SiteLibrary,
} from '@craftkit/builder-schema';

/**
 * The stylesheet a site's design library contributes (style-manager
 * DESIGN.md §2):
 *
 *   1. one `@import` per Google/Bunny font — FIRST, because CSS ignores an
 *      `@import` that follows any other rule;
 *   2. `@font-face` for each uploaded woff2, with `font-display: swap`;
 *   3. the palette as `--ck-c-<id>` custom properties on `:root` and
 *      `[data-ck-page]`, which is what `bg-(--ck-c-<id>)` resolves against.
 *
 * Tolerant like every reader in this package: it is handed a STORED library,
 * which was validated when written but may have been edited by hand since. So
 * each entry is re-parsed with its own schema and an entry that fails is left
 * out — one bad colour must not cost the page every other one, and a value
 * that is not a colour must never reach a declaration where a `;` or `}`
 * would start a rule nobody reviewed.
 */
export function buildLibraryCss(library: SiteLibrary | undefined): string {
  if (library === undefined) return '';
  const imports: string[] = [];
  const faces: string[] = [];
  for (const candidate of library.fonts ?? []) {
    const parsed = siteFontSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const font = parsed.data;
    if (font.source === 'upload') {
      faces.push(uploadedFontFace(font));
      continue;
    }
    const rule = fontImportRule(siteFontImportUrl(font));
    if (rule !== undefined && !imports.includes(rule)) imports.push(rule);
  }

  const declarations: string[] = [];
  for (const candidate of library.palette ?? []) {
    const parsed = paletteColorSchema.safeParse(candidate);
    if (!parsed.success) continue;
    declarations.push(`  ${paletteVariable(parsed.data.id)}: ${parsed.data.value};`);
  }
  const variables =
    declarations.length === 0 ? [] : [`:root,\n[data-ck-page] {\n${declarations.join('\n')}\n}`];

  return [...imports, ...faces, ...variables].join('\n');
}

/**
 * The stylesheet URL that loads a hosted font, or undefined for an upload.
 *
 * - Google: the css2 API, `family=Name+With+Spaces:wght@400;700` — or
 *   `ital,wght@0,400;…;1,700` when italics are wanted — each weight sorted,
 *   because the API refuses an unsorted axis list (HTTP 400).
 * - Bunny: its Google-compatible v1 API, `family=name-with-dashes:400,700,400i`.
 *
 * One URL per family on purpose: a weight a family lacks fails the WHOLE
 * request, and a combined import would then cost every other family too.
 */
export function siteFontImportUrl(font: SiteFont): string | undefined {
  const weights = [...font.weights].sort((left, right) => left - right);
  if (font.source === 'google') {
    const family = font.family.trim().replace(/\s+/gu, '+');
    const axis =
      font.italic === true
        ? `ital,wght@${[...weights.map((weight) => `0,${String(weight)}`), ...weights.map((weight) => `1,${String(weight)}`)].join(';')}`
        : `wght@${weights.join(';')}`;
    return `https://fonts.googleapis.com/css2?family=${family}:${axis}&display=swap`;
  }
  if (font.source === 'bunny') {
    const family = font.family
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/gu, '-');
    const variants = [
      ...weights.map(String),
      ...(font.italic === true ? weights.map((weight) => `${String(weight)}i`) : []),
    ];
    return `https://fonts.bunny.net/css?family=${family}:${variants.join(',')}&display=swap`;
  }
  return undefined;
}

/**
 * The `@import` rule for a font stylesheet — only for the two hosts the CSS
 * door admits (`CUSTOM_CSS_FONT_HOSTS`); any other URL yields undefined. The
 * URL is left unquoted (no character in a built URL needs quoting) and
 * anything that could end the `url()` early is refused outright.
 */
export function fontImportRule(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  if (!CUSTOM_CSS_FONT_HOSTS.some((host) => url.startsWith(host))) return undefined;
  if (/[\s"'()\\;]/u.test(url.replace(/;(?=\d)/gu, ''))) return undefined;
  return `@import url(${url});`;
}

function uploadedFontFace(font: SiteFont): string {
  const weights = [...font.weights].sort((left, right) => left - right);
  const low = weights[0] ?? 400;
  const high = weights[weights.length - 1] ?? low;
  /* Several weights in one file is a variable font: declare its range. */
  const weight = low === high ? String(low) : `${String(low)} ${String(high)}`;
  return [
    '@font-face {',
    `  font-family: "${font.family}";`,
    `  src: url(${font.url ?? ''}) format("woff2");`,
    `  font-weight: ${weight};`,
    `  font-style: ${font.italic === true ? 'italic' : 'normal'};`,
    '  font-display: swap;',
    '}',
  ].join('\n');
}
