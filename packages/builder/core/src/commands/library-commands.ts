import { z } from 'zod';

import {
  applySymbolOverrides,
  builderError,
  describeLibraryUsages,
  designSystemSchema,
  DETACHED_SYMBOL_BLOCK_TYPE,
  expandNamedStyleMarkers,
  findAssetUsages,
  findNamedStyleUsages,
  findPaletteUsages,
  findSymbolInstances,
  holdsClassToken,
  isSymbolInstance,
  LIBRARY_LIMITS,
  libraryHosts,
  libraryIdSchema,
  namedStyleClassProblem,
  namedStyleIdOf,
  namedStyleMarker,
  namedStyleSchema,
  paletteColorSchema,
  savedTemplateSchema,
  siteFontSchema,
  siteLibrarySchema,
  siteLibrarySettingsSchema,
  siteSymbolSchema,
  symbolCycle,
  symbolOverridesSchema,
  validateAssetEntry,
  validateDesignSystem,
  walkLibraryValues,
  type AssetEntry,
  type AssetId,
  type BuilderSite,
  type DesignSystem,
  type LibraryId,
  type NamedStyle,
  type PaletteColor,
  type RegisteredSiteCommand,
  type SavedTemplate,
  type SiteFont,
  type SiteLibrary,
  type SiteLibrarySettings,
  type SiteSymbol,
} from '@craftkit/builder-schema';

import { snapshot } from '../patches/immer';
import { defineSiteCommand } from './define-site-command';

/**
 * The SITE DESIGN LIBRARY commands (style-manager DESIGN.md §2, D5/D6).
 *
 * Spread into `siteCommands`, so each is one site production: one dispatch is
 * one transaction and one Undo, and a group mixing these with page commands is
 * still one. Like every site command, each refuses BEFORE it writes — a
 * removal that would leave a dangling reference names where the references
 * are, and the `detach` variants rewrite every holder in the SAME production
 * so "delete the style but keep the look" is one Undo, not several.
 */
export interface LibraryCommands {
  /** Upsert by id; `index` places (or moves) the entry. */
  setPaletteColor: { color: PaletteColor; index?: number };
  removePaletteColor: { id: LibraryId };
  /** Upsert by id. The class list is checked against the live vocabulary. */
  setNamedStyle: { style: NamedStyle };
  /** Refused while used, unless `detach` inlines the style into every user. */
  removeNamedStyle: { id: LibraryId; detach?: boolean };
  setSymbol: { symbol: SiteSymbol };
  /** Refused while instances exist, unless `detach` turns them into plain regions. */
  removeSymbol: { id: LibraryId; detach?: boolean };
  saveTemplate: { template: SavedTemplate };
  removeTemplate: { id: LibraryId };
  /** Replaces the whole font list; an empty list clears it. */
  setSiteFonts: { fonts: SiteFont[] };
  /** Merges the given settings into the current ones. */
  setLibrarySettings: { settings: SiteLibrarySettings };
  /** Replaces BOTH the design system and the library, validated, in one transaction. */
  importDesignLibrary: { designSystem: DesignSystem; library: SiteLibrary };
  updateAsset: {
    id: AssetId;
    patch: { alt?: string; description?: string; url?: string; width?: number; height?: number };
  };
  /** Refused while any page or region references the asset. */
  removeAsset: { id: AssetId };
}

export type LibraryCommandName = keyof LibraryCommands;

const assetId = z.string().min(1);

const fontListSchema = z
  .array(siteFontSchema)
  .max(LIBRARY_LIMITS.fonts)
  .refine(
    (fonts) => new Set(fonts.map((font) => font.family.toLowerCase())).size === fonts.length,
    'A font family is listed twice.',
  );

export const libraryCommands: Record<LibraryCommandName, RegisteredSiteCommand> = {
  setPaletteColor: defineSiteCommand({
    args: z.strictObject({
      color: paletteColorSchema,
      index: z.number().int().nonnegative().optional(),
    }),
    run: (args) => (draft) => {
      const library = mutableLibrary(draft);
      const palette = [...(snapshot(library).palette ?? [])];
      const at = palette.findIndex((entry) => entry.id === args.color.id);
      if (at === -1 && palette.length >= LIBRARY_LIMITS.palette) {
        throw libraryError(
          `The palette is full (${String(LIBRARY_LIMITS.palette)} colours); remove one first.`,
          ['color'],
        );
      }
      if (at !== -1) palette.splice(at, 1);
      const index = args.index ?? (at === -1 ? palette.length : at);
      if (index > palette.length) {
        throw libraryError(
          `Index ${String(index)} is past the end of the palette (${String(palette.length)}).`,
          ['index'],
        );
      }
      palette.splice(index, 0, args.color);
      library.palette = palette;
    },
  }),

  removePaletteColor: defineSiteCommand({
    args: z.strictObject({ id: libraryIdSchema }),
    run: (args) => (draft) => {
      const palette = draft.library?.palette ?? [];
      if (!palette.some((entry) => entry.id === args.id)) {
        throw libraryError(`Palette colour "${args.id}" does not exist.`, ['id']);
      }
      const usages = findPaletteUsages(snapshot(draft), args.id);
      if (usages.length > 0) {
        throw libraryError(
          `Palette colour "${args.id}" is still used (${String(usages.length)}): ${describeLibraryUsages(usages)}.`,
          ['id'],
        );
      }
      const library = mutableLibrary(draft);
      library.palette = palette.filter((entry) => entry.id !== args.id);
      pruneLibrary(draft);
    },
  }),

  setNamedStyle: defineSiteCommand({
    args: z.strictObject({ style: namedStyleSchema }),
    run: (args) => (draft) => {
      const problem = namedStyleClassProblem(args.style.className);
      if (problem !== undefined) {
        throw libraryError(`Style "${args.style.id}": ${problem}`, ['style', 'className']);
      }
      const library = mutableLibrary(draft);
      const styles = library.styles ?? {};
      requireRoom(styles, args.style.id, LIBRARY_LIMITS.styles, 'named styles', ['style']);
      library.styles = { ...snapshot(styles), [args.style.id]: args.style };
    },
  }),

  removeNamedStyle: defineSiteCommand({
    args: z.strictObject({ id: libraryIdSchema, detach: z.boolean().optional() }),
    run: (args) => (draft) => {
      const styles = snapshot(draft.library?.styles ?? {});
      if (!Object.hasOwn(styles, args.id)) {
        throw libraryError(`Named style "${args.id}" does not exist.`, ['id']);
      }
      const usages = findNamedStyleUsages(snapshot(draft), args.id);
      if (usages.length > 0 && args.detach !== true) {
        throw libraryError(
          `Named style "${args.id}" is still used by ${String(usages.length)} element(s): ${describeLibraryUsages(usages)}. Remove it from them, or detach to keep their look.`,
          ['id'],
        );
      }
      if (usages.length > 0) detachNamedStyle(draft, args.id, styles);
      const library = mutableLibrary(draft);
      const next = { ...styles };
      delete next[args.id];
      library.styles = next;
      pruneLibrary(draft);
    },
  }),

  setSymbol: defineSiteCommand({
    args: z.strictObject({ symbol: siteSymbolSchema }),
    run: (args) => (draft) => {
      const cycle = symbolCycle(snapshot(draft.library), args.symbol.id, args.symbol);
      if (cycle !== undefined) {
        throw libraryError(
          `Symbol "${args.symbol.id}" would contain itself: ${cycle.join(' → ')}.`,
          ['symbol', 'tree'],
        );
      }
      const library = mutableLibrary(draft);
      const symbols = library.symbols ?? {};
      requireRoom(symbols, args.symbol.id, LIBRARY_LIMITS.symbols, 'symbols', ['symbol']);
      library.symbols = { ...snapshot(symbols), [args.symbol.id]: args.symbol };
    },
  }),

  removeSymbol: defineSiteCommand({
    args: z.strictObject({ id: libraryIdSchema, detach: z.boolean().optional() }),
    run: (args) => (draft) => {
      const symbols = snapshot(draft.library?.symbols ?? {});
      const symbol = Object.hasOwn(symbols, args.id) ? symbols[args.id] : undefined;
      if (symbol === undefined) {
        throw libraryError(`Symbol "${args.id}" does not exist.`, ['id']);
      }
      const instances = findSymbolInstances(snapshot(draft), args.id);
      if (instances.length > 0 && args.detach !== true) {
        throw libraryError(
          `Symbol "${args.id}" still has ${String(instances.length)} instance(s): ${describeLibraryUsages(instances)}. Remove them, or detach them into plain regions.`,
          ['id'],
        );
      }
      if (instances.length > 0) detachSymbol(draft, symbol);
      const library = mutableLibrary(draft);
      const next = { ...snapshot(library.symbols ?? {}) };
      delete next[args.id];
      library.symbols = next;
      pruneLibrary(draft);
    },
  }),

  saveTemplate: defineSiteCommand({
    args: z.strictObject({ template: savedTemplateSchema }),
    run: (args) => (draft) => {
      const library = mutableLibrary(draft);
      const templates = library.templates ?? {};
      requireRoom(templates, args.template.id, LIBRARY_LIMITS.templates, 'templates', ['template']);
      library.templates = { ...snapshot(templates), [args.template.id]: args.template };
    },
  }),

  removeTemplate: defineSiteCommand({
    args: z.strictObject({ id: libraryIdSchema }),
    run: (args) => (draft) => {
      const templates = snapshot(draft.library?.templates ?? {});
      if (!Object.hasOwn(templates, args.id)) {
        throw libraryError(`Template "${args.id}" does not exist.`, ['id']);
      }
      const library = mutableLibrary(draft);
      const next = { ...templates };
      delete next[args.id];
      library.templates = next;
      pruneLibrary(draft);
    },
  }),

  setSiteFonts: defineSiteCommand({
    args: z.strictObject({ fonts: fontListSchema }),
    run: (args) => (draft) => {
      const library = mutableLibrary(draft);
      library.fonts = args.fonts;
      pruneLibrary(draft);
    },
  }),

  setLibrarySettings: defineSiteCommand({
    args: z.strictObject({ settings: siteLibrarySettingsSchema }),
    run: (args) => (draft) => {
      const library = mutableLibrary(draft);
      const next: SiteLibrarySettings = { ...snapshot(library.settings ?? {}) };
      if (args.settings.pageTransitions !== undefined) {
        next.pageTransitions = args.settings.pageTransitions;
      }
      if (args.settings.smoothScroll !== undefined) next.smoothScroll = args.settings.smoothScroll;
      library.settings = next;
      pruneLibrary(draft);
    },
  }),

  importDesignLibrary: defineSiteCommand({
    args: z.strictObject({ designSystem: designSystemSchema, library: siteLibrarySchema }),
    run: (args) => (draft) => {
      const legible = validateDesignSystem(args.designSystem);
      if (!legible.ok) {
        throw libraryError(
          `The imported design system would not be legible: ${legible.issues[0]?.message ?? 'unknown'}`,
          ['designSystem'],
        );
      }
      for (const style of Object.values(args.library.styles ?? {})) {
        const problem = namedStyleClassProblem(style.className);
        if (problem !== undefined) {
          throw libraryError(`Imported style "${style.id}": ${problem}`, [
            'library',
            'styles',
            style.id,
            'className',
          ]);
        }
      }
      for (const id of Object.keys(args.library.symbols ?? {})) {
        const cycle = symbolCycle(args.library, id);
        if (cycle !== undefined) {
          throw libraryError(`Imported symbol "${id}" contains itself: ${cycle.join(' → ')}.`, [
            'library',
            'symbols',
            id,
          ]);
        }
      }
      draft.designSystem = args.designSystem;
      draft.library = args.library;
      pruneLibrary(draft);
    },
  }),

  updateAsset: defineSiteCommand({
    args: z.strictObject({
      id: assetId,
      patch: z
        .strictObject({
          alt: z.string().max(500).optional(),
          description: z.string().max(2_000).optional(),
          url: z.string().min(1).optional(),
          width: z.number().int().nonnegative().optional(),
          height: z.number().int().nonnegative().optional(),
        })
        .refine((patch) => Object.keys(patch).length > 0, 'An asset update changes something.'),
    }),
    run: (args) => (draft) => {
      const assets = mutableAssets(draft);
      const current = Object.hasOwn(assets, args.id) ? snapshot(assets[args.id]) : undefined;
      if (current === undefined) {
        throw libraryError(`Asset "${args.id}" does not exist.`, ['id']);
      }
      const merged: AssetEntry = { ...current };
      if (args.patch.alt !== undefined) merged.alt = args.patch.alt;
      if (args.patch.description !== undefined) merged.description = args.patch.description;
      if (args.patch.url !== undefined) merged.url = args.patch.url;
      if (args.patch.width !== undefined) merged.width = args.patch.width;
      if (args.patch.height !== undefined) merged.height = args.patch.height;
      const parsed = validateAssetEntry(merged);
      if (!parsed.ok) {
        throw libraryError(parsed.issues[0]?.message ?? 'The asset entry is malformed.', ['patch']);
      }
      assets[args.id] = parsed.entry;
    },
  }),

  removeAsset: defineSiteCommand({
    args: z.strictObject({ id: assetId }),
    run: (args) => (draft) => {
      const assets = mutableAssets(draft);
      if (!Object.hasOwn(assets, args.id)) {
        throw libraryError(`Asset "${args.id}" does not exist.`, ['id']);
      }
      const usages = findAssetUsages(snapshot(draft), args.id);
      if (usages.length > 0) {
        throw libraryError(
          `Asset "${args.id}" is still used (${String(usages.length)}): ${describeLibraryUsages(usages)}.`,
          ['id'],
        );
      }
      delete assets[args.id];
    },
  }),
};

// ── Detach ───────────────────────────────────────────────────────────────────

/**
 * Inline style `id` into every holder of its marker, keeping the holder's
 * other markers (combo styles stay combo styles). Writes through the draft, so
 * every rewrite lands in the removing command's own production.
 */
function detachNamedStyle(
  draft: BuilderSite,
  id: LibraryId,
  styles: Readonly<Record<LibraryId, NamedStyle>>,
): void {
  const marker = namedStyleMarker(id);
  const holders: { className: string }[] = [];
  for (const host of libraryHosts(draft)) {
    walkLibraryValues(host.value, (value) => {
      if (holdsClassToken(value, marker)) holders.push(value);
    });
  }
  for (const holder of holders) {
    const keep = new Set(
      holder.className
        .split(/\s+/u)
        .map(namedStyleIdOf)
        .filter((other): other is LibraryId => other !== undefined && other !== id),
    );
    holder.className = expandNamedStyleMarkers(holder.className, styles, keep);
  }
}

interface InstanceHolder {
  type?: string;
  kind?: string;
  component?: string;
  props: Record<string, unknown>;
  children?: unknown;
}

/**
 * Turn every instance of `symbol` into a plain composed region carrying the
 * master's tree with that instance's overrides applied. A document node
 * becomes a `customCode` node; a tree component reference becomes a
 * `customCode` component (it has no slot, so its children go).
 */
function detachSymbol(draft: BuilderSite, symbol: SiteSymbol): void {
  const holders: InstanceHolder[] = [];
  for (const host of libraryHosts(draft)) {
    walkLibraryValues(host.value, (value) => {
      if (isSymbolInstance(value, symbol.id)) holders.push(value as InstanceHolder);
    });
  }
  for (const holder of holders) {
    const props = snapshot(holder.props);
    const overrides = symbolOverridesSchema.safeParse(props['overrides']);
    const label = typeof props['label'] === 'string' ? props['label'] : symbol.name;
    holder.props = {
      label: label.slice(0, 80),
      tree: applySymbolOverrides(symbol.tree, overrides.success ? overrides.data : undefined),
      css: symbol.css ?? '',
    };
    if (holder.kind === 'component') {
      holder.component = DETACHED_SYMBOL_BLOCK_TYPE;
      delete holder.children;
    } else {
      holder.type = DETACHED_SYMBOL_BLOCK_TYPE;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function libraryError(message: string, path?: (string | number)[]) {
  return builderError('site/structural-violation', message, path);
}

/** The draft's library, created empty on first write. */
function mutableLibrary(draft: BuilderSite): SiteLibrary {
  draft.library ??= {};
  return draft.library;
}

function mutableAssets(draft: BuilderSite): Record<string, AssetEntry> {
  return draft.assets;
}

/*
  An emptied collection is removed rather than stored as `[]` or `{}`, and an
  emptied library goes with it — so "add a colour, remove it" leaves the site
  byte-identical to before, which is what lets a stored site stay free of a
  field it never meaningfully had.
*/
function pruneLibrary(draft: BuilderSite): void {
  const library = draft.library;
  if (library === undefined) return;
  const record = library as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    const empty =
      value === undefined ||
      (Array.isArray(value) ? value.length === 0 : Object.keys(value as object).length === 0);
    if (empty) delete record[key];
  }
  if (Object.keys(record).length === 0) delete draft.library;
}

function requireRoom(
  record: Readonly<Record<string, unknown>>,
  id: string,
  max: number,
  what: string,
  path: (string | number)[],
): void {
  if (!Object.hasOwn(record, id) && Object.keys(record).length >= max) {
    throw libraryError(`The library already holds ${String(max)} ${what}; remove one first.`, path);
  }
}
