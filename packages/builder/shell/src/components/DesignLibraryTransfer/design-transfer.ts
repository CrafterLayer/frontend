import type { SiteGroupStep } from '@craftkit/builder-core';
import {
  designSystemSchema,
  findNamedStyleUsages,
  findPaletteUsages,
  namedStyleClassProblem,
  siteLibrarySchema,
  TOKEN_NAMES,
  validateDesignSystem,
  type BuilderSite,
  type DesignSystem,
  type NamedStyle,
  type PaletteColor,
  type SiteFont,
  type SiteLibrary,
} from '@craftkit/builder-schema';

/*
  ── Design system import / export (style-manager DESIGN.md §G) ────────────

  The file carries what makes a site LOOK like itself — the token system,
  the palette, the named styles and the fonts — and nothing that is content:
  symbols and templates hold page material and stay behind, so importing a
  look never rewrites a site's pages.

  Import is checked like every write (shape, legibility, the class
  vocabulary) BEFORE the person is asked, then sent as ONE
  `importDesignLibrary`, so one Undo restores the site exactly. Entries an
  element still uses are never dropped by an import, even in replace mode.
*/

export const DESIGN_FILE_FORMAT = 'craftkit-design';
export const DESIGN_FILE_VERSION = 1;

export interface DesignFileLibrary {
  palette?: PaletteColor[] | undefined;
  styles?: Record<string, NamedStyle> | undefined;
  fonts?: SiteFont[] | undefined;
}

export interface DesignFile {
  format: typeof DESIGN_FILE_FORMAT;
  v: typeof DESIGN_FILE_VERSION;
  designSystem: DesignSystem;
  library: DesignFileLibrary;
}

/** The site's look as a design file. */
export function exportDesignFile(site: Readonly<BuilderSite>): DesignFile {
  const library = site.library ?? {};
  return {
    format: DESIGN_FILE_FORMAT,
    v: DESIGN_FILE_VERSION,
    designSystem: site.designSystem,
    library: {
      ...(library.palette === undefined ? {} : { palette: library.palette }),
      ...(library.styles === undefined ? {} : { styles: library.styles }),
      ...(library.fonts === undefined ? {} : { fonts: library.fonts }),
    },
  };
}

/** A download-ready file name: `<system name>.craftkit-design.json`. */
export function designFileName(file: DesignFile): string {
  const stem = file.designSystem.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return `${stem === '' ? 'design-system' : stem}.craftkit-design.json`;
}

export type DesignFileParse =
  | { readonly ok: true; readonly file: DesignFile }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse and check a design file: format, version, shape, legibility and class vocabulary. */
export function parseDesignFile(text: string): DesignFileParse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, message: 'The file is not JSON.' };
  }
  if (!isRecord(value) || value['format'] !== DESIGN_FILE_FORMAT) {
    return { ok: false, message: `The file is not a CraftKit design file (format "${DESIGN_FILE_FORMAT}").` };
  }
  if (value['v'] !== DESIGN_FILE_VERSION) {
    return { ok: false, message: `This design file is version ${String(value['v'])}; this editor reads version ${String(DESIGN_FILE_VERSION)}.` };
  }
  const system = designSystemSchema.safeParse(value['designSystem']);
  if (!system.success) {
    return { ok: false, message: `The design system is malformed: ${system.error.issues[0]?.message ?? 'unknown'}.` };
  }
  const legible = validateDesignSystem(system.data);
  if (!legible.ok) {
    return { ok: false, message: `The design system would not be legible: ${legible.issues[0]?.message ?? 'unknown'}.` };
  }
  const raw = isRecord(value['library']) ? value['library'] : {};
  const extra = Object.keys(raw).filter((key) => !['palette', 'styles', 'fonts'].includes(key));
  if (extra.length > 0) {
    return { ok: false, message: `A design file carries palette, styles and fonts only; found ${extra.join(', ')}.` };
  }
  const library = siteLibrarySchema.safeParse(raw);
  if (!library.success) {
    const issue = library.error.issues[0];
    return { ok: false, message: `The library is malformed at ${issue?.path.join('.') ?? '?'}: ${issue?.message ?? 'unknown'}.` };
  }
  for (const style of Object.values(library.data.styles ?? {})) {
    const problem = namedStyleClassProblem(style.className);
    if (problem !== undefined) return { ok: false, message: `Style "${style.name}": ${problem}` };
  }
  return {
    ok: true,
    file: {
      format: DESIGN_FILE_FORMAT,
      v: DESIGN_FILE_VERSION,
      designSystem: system.data,
      library: {
        ...(library.data.palette === undefined ? {} : { palette: library.data.palette }),
        ...(library.data.styles === undefined ? {} : { styles: library.data.styles }),
        ...(library.data.fonts === undefined ? {} : { fonts: library.data.fonts }),
      },
    },
  };
}

export interface CollectionDiff {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
  /** Entries replace mode would remove but keeps, because something uses them. */
  readonly keptInUse: readonly string[];
}

export interface DesignDiff {
  readonly systemName: { readonly from: string; readonly to: string };
  readonly tokens: readonly string[];
  readonly palette: CollectionDiff;
  readonly styles: CollectionDiff;
  readonly fonts: CollectionDiff;
}

function diffBy<T>(
  current: readonly T[],
  incoming: readonly T[],
  key: (entry: T) => string,
  replace: boolean,
  inUse: (id: string) => boolean,
): CollectionDiff {
  const before = new Map(current.map((entry) => [key(entry), entry]));
  const after = new Map(incoming.map((entry) => [key(entry), entry]));
  const added = [...after.keys()].filter((id) => !before.has(id));
  const changed = [...after.keys()].filter(
    (id) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)),
  );
  const missing = replace ? [...before.keys()].filter((id) => !after.has(id)) : [];
  return {
    added,
    changed,
    removed: missing.filter((id) => !inUse(id)),
    keptInUse: missing.filter((id) => inUse(id)),
  };
}

/** What importing `file` would change, and what replace mode would keep because it is used. */
export function diffDesign(site: Readonly<BuilderSite>, file: DesignFile, replace: boolean): DesignDiff {
  const current = site.library ?? {};
  const mutable = site as BuilderSite;
  return {
    systemName: { from: site.designSystem.name, to: file.designSystem.name },
    tokens: TOKEN_NAMES.filter((token) => site.designSystem.tokens[token] !== file.designSystem.tokens[token]),
    palette: diffBy(current.palette ?? [], file.library.palette ?? [], (color) => color.id, replace, (id) =>
      findPaletteUsages(mutable, id).length > 0,
    ),
    styles: diffBy(
      Object.values(current.styles ?? {}),
      Object.values(file.library.styles ?? {}),
      (style) => style.id,
      replace,
      (id) => findNamedStyleUsages(mutable, id).length > 0,
    ),
    fonts: diffBy(current.fonts ?? [], file.library.fonts ?? [], (font) => font.family.toLowerCase(), replace, () => false),
  };
}

/**
 * The library after the import. Merge mode: imported entries replace same-id
 * ones, the rest stay. Replace mode: only the file's entries plus the ones
 * still in use. Symbols, templates and settings are never touched.
 */
export function importedLibrary(
  site: Readonly<BuilderSite>,
  file: DesignFile,
  replace: boolean,
): SiteLibrary {
  const current = site.library ?? {};
  const diff = diffDesign(site, file, replace);
  const keepPalette = new Set(diff.palette.keptInUse);
  const keepStyles = new Set(diff.styles.keptInUse);
  const incomingPalette = file.library.palette ?? [];
  const incomingIds = new Set(incomingPalette.map((color) => color.id));
  const palette = [
    ...(current.palette ?? []).filter(
      (color) => !incomingIds.has(color.id) && (!replace || keepPalette.has(color.id)),
    ),
    ...incomingPalette,
  ];
  const styles: Record<string, NamedStyle> = {};
  for (const style of Object.values(current.styles ?? {})) {
    if (!replace || keepStyles.has(style.id)) styles[style.id] = style;
  }
  for (const style of Object.values(file.library.styles ?? {})) styles[style.id] = style;
  const incomingFonts = file.library.fonts ?? [];
  const families = new Set(incomingFonts.map((font) => font.family.toLowerCase()));
  const fonts = [
    ...(replace ? [] : (current.fonts ?? []).filter((font) => !families.has(font.family.toLowerCase()))),
    ...incomingFonts,
  ];
  const next: SiteLibrary = {};
  if (palette.length > 0) next.palette = palette;
  if (Object.keys(styles).length > 0) next.styles = styles;
  if (fonts.length > 0) next.fonts = fonts;
  if (current.symbols !== undefined) next.symbols = current.symbols;
  if (current.templates !== undefined) next.templates = current.templates;
  if (current.settings !== undefined) next.settings = current.settings;
  return next;
}

/** The one step that imports a design file. */
export function importDesignSteps(
  site: Readonly<BuilderSite>,
  file: DesignFile,
  replace: boolean,
): readonly SiteGroupStep[] {
  return [
    {
      command: 'importDesignLibrary',
      args: { designSystem: file.designSystem, library: importedLibrary(site, file, replace) },
    },
  ];
}
