import { twMerge } from 'tailwind-merge';
import { z } from 'zod';

import {
  CUSTOM_CODE_ATTRIBUTES,
  customCodeTreeSchema,
  type CustomCodeNode,
  type CustomCodeRoot,
} from '../custom-code/custom-code-tree';
import { findCssRejection } from '../custom-code/custom-css';
import { unknownUtilityClasses } from '../custom-code/utility-vocabulary';
// pixi-studio:schema-library additions (2026-10-10): the Studio's script and sound entries (DESIGN §A.1).
import { scriptEntrySchema, soundEntrySchema } from '../studio/schemas';
import type { ScriptEntry, SoundEntry } from '../studio/types';
// end pixi-studio:schema-library additions

/**
 * The SITE DESIGN LIBRARY (style-manager DESIGN.md §2, decisions D5/D6).
 *
 * A Webflow-style design system that sits beside `designSystem` rather than
 * inside it: the tokens stay what they are (nine roles, a type scale, radii),
 * and the library adds what a token map cannot hold — free palette entries,
 * named styles ("classes"), symbols, saved templates, site fonts and site-wide
 * motion settings.
 *
 * It is OPTIONAL on `BuilderSite`, so no stored site changes shape and no
 * migration runs: a site without a library is a site whose library is empty.
 *
 * Every shape here is strict and bounded. The library is written by commands
 * the agent can call, so each limit below is a limit on what one plan can make
 * the site carry.
 */

// ── Identity ─────────────────────────────────────────────────────────────────

export type LibraryId = string;

/** Lower-case kebab id: it becomes a CSS identifier (`--ck-c-<id>`, `ck-s-<id>`). */
export const LIBRARY_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/u;

/*
  `constructor` and `prototype` satisfy the pattern, and a record keyed by
  either would shadow an Object.prototype member for every reader that indexes
  without `Object.hasOwn`. Refused once here rather than guarded at each read.
*/
const RESERVED_LIBRARY_IDS: ReadonlySet<string> = new Set(['constructor', 'prototype']);

export const libraryIdSchema: z.ZodType<LibraryId> = z
  .string()
  .regex(
    LIBRARY_ID_PATTERN,
    'A library id is lower-case kebab-case: a letter, then up to 47 of a-z, 0-9 or "-".',
  )
  .refine((id) => !RESERVED_LIBRARY_IDS.has(id), 'That library id is reserved.');

export function isLibraryId(value: unknown): value is LibraryId {
  return libraryIdSchema.safeParse(value).success;
}

// ── Limits ───────────────────────────────────────────────────────────────────

export const LIBRARY_LIMITS = {
  palette: 120,
  styles: 300,
  symbols: 100,
  templates: 200,
  overrides: 200,
  fonts: 24,
  weightsPerFont: 18,
  styleClassName: 1_000,
  /** The region `css` cap DESIGN §1 D1 raises to; symbols and templates carry one. */
  css: 24_000,
  name: 80,
  overrideText: 10_000,
  /** Decoded bytes of an uploaded woff2. */
  uploadedFontBytes: 600 * 1024,
  // pixi-studio:schema-library additions (2026-10-10)
  scripts: 200,
  sounds: 120,
  // end pixi-studio:schema-library additions
} as const;

// ── Types (DESIGN §2, exact; optionals admit `undefined` for zod parity) ─────

export interface PaletteColor {
  id: LibraryId;
  name: string;
  /** `#hex`, `rgb()`, `hsl()` or `oklch()`. */
  value: string;
  group?: string | undefined;
}

export interface NamedStyle {
  id: LibraryId;
  name: string;
  /** Utilities, free mode, ≤ 1000 characters, never a `ck-s-` marker. */
  className: string;
}

export interface SymbolOverride {
  /** A custom-code path inside the symbol's tree. */
  path: number[];
  text?: string | undefined;
  className?: string | undefined;
  /** `null` removes the attribute from the instance. */
  attributes?: Record<string, string | null> | undefined;
}

export interface SiteSymbol {
  id: LibraryId;
  name: string;
  tree: CustomCodeRoot;
  css?: string | undefined;
}

export interface SavedTemplate {
  id: LibraryId;
  name: string;
  kind: 'element' | 'section';
  tree: CustomCodeRoot;
  css?: string | undefined;
  /** ISO-8601 instant, supplied by the caller (commands stay deterministic). */
  savedAt: string;
}

export type SiteFontSource = 'google' | 'bunny' | 'upload';
export type SiteFontScript = 'arabic' | 'latin';

export interface SiteFont {
  family: string;
  source: SiteFontSource;
  weights: number[];
  italic?: boolean | undefined;
  scripts?: SiteFontScript[] | undefined;
  /** Upload only: `data:font/woff2;base64,…`, ≤ 600 kB decoded. */
  url?: string | undefined;
}

export interface SiteLibrarySettings {
  pageTransitions?: boolean | undefined;
  smoothScroll?: boolean | undefined;
}

export interface SiteLibrary {
  palette?: PaletteColor[] | undefined;
  styles?: Record<LibraryId, NamedStyle> | undefined;
  symbols?: Record<LibraryId, SiteSymbol> | undefined;
  templates?: Record<LibraryId, SavedTemplate> | undefined;
  fonts?: SiteFont[] | undefined;
  settings?: SiteLibrarySettings | undefined;
  // pixi-studio:schema-library additions (2026-10-10): Pixi Studio project tier (§A.2).
  scripts?: Record<LibraryId, ScriptEntry> | undefined;
  sounds?: Record<LibraryId, SoundEntry> | undefined;
  // end pixi-studio:schema-library additions
}

// ── Markers and names other layers share ─────────────────────────────────────

/** The class an element carries to apply a named style (DESIGN D6). */
export const NAMED_STYLE_MARKER_PREFIX = 'ck-s-';

export function namedStyleMarker(id: LibraryId): string {
  return `${NAMED_STYLE_MARKER_PREFIX}${id}`;
}

/** The style id a marker class names, or undefined when it is not a marker. */
export function namedStyleIdOf(className: string): LibraryId | undefined {
  if (!className.startsWith(NAMED_STYLE_MARKER_PREFIX)) return undefined;
  const id = className.slice(NAMED_STYLE_MARKER_PREFIX.length);
  return isLibraryId(id) ? id : undefined;
}

/** The CSS custom property a palette entry is published as (`bg-(--ck-c-<id>)`). */
export function paletteVariable(id: LibraryId): string {
  return `--ck-c-${id}`;
}

/** The registered block type of a symbol instance (DESIGN §G; built by P9). */
export const SYMBOL_INSTANCE_BLOCK_TYPE = 'customCodeSymbol';
/** The block a detached instance becomes: a plain composed region. */
export const DETACHED_SYMBOL_BLOCK_TYPE = 'customCode';

// ── Colour values ────────────────────────────────────────────────────────────

const HEX_COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const FUNCTION_COLOUR = /^(rgba?|hsla?|oklch)\(\s*([^()]*?)\s*\)$/iu;
const COLOUR_COMPONENT = /^(?:none|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:%|deg|grad|rad|turn)?)$/iu;

/**
 * Whether a palette value is a colour this library can publish.
 *
 * Structural, not perceptual: the value becomes the right-hand side of a CSS
 * custom property, so the only thing that matters at this door is that it is
 * ONE colour token and nothing else — a `;` or `}` here would end the
 * declaration and start a rule nobody reviewed.
 */
export function isPaletteColorValue(value: string): boolean {
  if (HEX_COLOUR.test(value)) return true;
  const match = FUNCTION_COLOUR.exec(value);
  if (match === null) return false;
  const components = (match[2] ?? '').split(/[\s,/]+/u).filter((part) => part !== '');
  if (components.length < 3 || components.length > 4) return false;
  return components.every((part) => COLOUR_COMPONENT.test(part));
}

// ── Class strings ────────────────────────────────────────────────────────────

/*
  A class list is rendered into an attribute by React, so injection is not the
  concern; legibility is. Control characters, `<` and double quotes have no
  business in a Tailwind class and are the usual signature of markup pasted
  into the wrong field.
*/
const CLASS_TEXT = /^[^\u0000-\u001f\u007f<"`\\]*$/u;

function classTokens(className: string): string[] {
  return className.split(/\s+/u).filter((token) => token !== '');
}

/** Whether a class list carries a named-style marker. */
export function hasNamedStyleMarker(className: string): boolean {
  return classTokens(className).some((token) => token.startsWith(NAMED_STYLE_MARKER_PREFIX));
}

/**
 * The door half of a named style's class check (DESIGN §2 "free mode").
 *
 * Kept OUT of the stored-shape schema on purpose: whether `p-[17px]` is a real
 * class depends on the host's runtime compiler (`setUtilityClassOracle`), and a
 * site saved in the editor must still open in a process that has no compiler —
 * an MCP server, the exporter, a test. So the shape is checked everywhere and
 * the vocabulary is checked where a person or the agent WRITES.
 */
export function namedStyleClassProblem(className: string): string | undefined {
  if (hasNamedStyleMarker(className)) {
    return 'A named style cannot contain another named style marker (ck-s-…); combine styles on the element instead.';
  }
  const unknown = unknownUtilityClasses(className);
  if (unknown.length > 0) {
    return `Unknown utility class${unknown.length === 1 ? '' : 'es'}: ${unknown.slice(0, 8).join(', ')}.`;
  }
  return undefined;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const nameSchema = z.string().trim().min(1).max(LIBRARY_LIMITS.name);

const libraryCssSchema = z
  .string()
  .max(LIBRARY_LIMITS.css)
  .refine((css) => findCssRejection(css) === undefined, {
    message: 'The stylesheet uses a construct the door refuses (@import, insecure url(), script).',
  });

export const paletteColorSchema: z.ZodType<PaletteColor> = z.strictObject({
  id: libraryIdSchema,
  name: nameSchema,
  value: z
    .string()
    .trim()
    .max(120)
    .refine(isPaletteColorValue, 'A palette value is one colour: #hex, rgb(), hsl() or oklch().'),
  group: z.string().trim().min(1).max(40).optional(),
});

export const namedStyleSchema: z.ZodType<NamedStyle> = z.strictObject({
  id: libraryIdSchema,
  name: nameSchema,
  className: z
    .string()
    .max(LIBRARY_LIMITS.styleClassName)
    .regex(CLASS_TEXT, 'A class list cannot contain control characters, quotes, "<" or "\\".')
    .refine((value) => !hasNamedStyleMarker(value), 'A named style cannot contain a ck-s- marker.'),
});

const overrideAttributeName = z
  .string()
  .refine(
    (name) => (CUSTOM_CODE_ATTRIBUTES as readonly string[]).includes(name),
    'An override may only set an attribute the custom-code vocabulary admits.',
  );

export const symbolOverrideSchema: z.ZodType<SymbolOverride> = z.strictObject({
  path: z.array(z.number().int().nonnegative()).min(1).max(30),
  text: z.string().max(LIBRARY_LIMITS.overrideText).optional(),
  className: z
    .string()
    .max(LIBRARY_LIMITS.styleClassName * 2)
    .regex(CLASS_TEXT, 'A class list cannot contain control characters, quotes, "<" or "\\".')
    .optional(),
  attributes: z.record(overrideAttributeName, z.string().max(2_000).nullable()).optional(),
});

export const symbolOverridesSchema: z.ZodType<SymbolOverride[]> = z
  .array(symbolOverrideSchema)
  .max(LIBRARY_LIMITS.overrides);

export const siteSymbolSchema: z.ZodType<SiteSymbol> = z.strictObject({
  id: libraryIdSchema,
  name: nameSchema,
  tree: customCodeTreeSchema,
  css: libraryCssSchema.optional(),
});

export const savedTemplateSchema: z.ZodType<SavedTemplate> = z.strictObject({
  id: libraryIdSchema,
  name: nameSchema,
  kind: z.enum(['element', 'section']),
  tree: customCodeTreeSchema,
  css: libraryCssSchema.optional(),
  savedAt: z.iso.datetime({ offset: true }),
});

/** A family name safe to quote in CSS and to spell in a font-service URL. */
export const SITE_FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/u;
export const UPLOADED_FONT_PREFIX = 'data:font/woff2;base64,';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;

/** Decoded byte length of a base64 payload (padding-aware). */
function base64Bytes(payload: string): number {
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/** Whether `url` is an uploaded woff2 the library may carry. */
export function isUploadedFontUrl(url: string): boolean {
  if (!url.startsWith(UPLOADED_FONT_PREFIX)) return false;
  const payload = url.slice(UPLOADED_FONT_PREFIX.length);
  /* Length first, so a hostile multi-megabyte string never reaches the regex. */
  if (
    payload.length === 0 ||
    payload.length > Math.ceil(LIBRARY_LIMITS.uploadedFontBytes / 3) * 4
  ) {
    return false;
  }
  return BASE64.test(payload) && base64Bytes(payload) <= LIBRARY_LIMITS.uploadedFontBytes;
}

export const siteFontSchema: z.ZodType<SiteFont> = z
  .strictObject({
    family: z
      .string()
      .regex(SITE_FONT_FAMILY, 'A font family is letters, digits, spaces, "_" or "-" (≤ 64).'),
    source: z.enum(['google', 'bunny', 'upload']),
    weights: z
      .array(z.number().int().min(1).max(1000))
      .min(1)
      .max(LIBRARY_LIMITS.weightsPerFont)
      .refine((weights) => new Set(weights).size === weights.length, 'A weight is listed twice.'),
    italic: z.boolean().optional(),
    scripts: z
      .array(z.enum(['arabic', 'latin']))
      .max(2)
      .refine((scripts) => new Set(scripts).size === scripts.length, 'A script is listed twice.')
      .optional(),
    url: z.string().optional(),
  })
  .superRefine((font, context) => {
    if (font.source === 'upload') {
      if (font.url === undefined || !isUploadedFontUrl(font.url)) {
        context.addIssue({
          code: 'custom',
          path: ['url'],
          message: `An uploaded font is a ${UPLOADED_FONT_PREFIX}… url of at most 600 kB.`,
        });
      }
    } else if (font.url !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'A Google or Bunny font is loaded by family; it carries no url.',
      });
    }
  });

export const siteLibrarySettingsSchema: z.ZodType<SiteLibrarySettings> = z.strictObject({
  pageTransitions: z.boolean().optional(),
  smoothScroll: z.boolean().optional(),
});

/**
 * A library-id-keyed record whose every key is its entry's own id, bounded.
 * The key IS the identity; an entry stored under another key would be two
 * names for one thing, and the second one is the one nobody updates.
 */
function libraryRecord<T extends { id: string }>(
  entry: z.ZodType<T>,
  max: number,
  what: string,
): z.ZodType<Record<LibraryId, T>> {
  return z.record(libraryIdSchema, entry).superRefine((record: Record<string, T>, context) => {
    const entries = Object.entries(record);
    if (entries.length > max) {
      context.addIssue({
        code: 'custom',
        message: `A library holds at most ${String(max)} ${what}; found ${String(entries.length)}.`,
      });
    }
    for (const [key, value] of entries) {
      if (value.id !== key) {
        context.addIssue({
          code: 'custom',
          path: [key, 'id'],
          message: `The ${what.replace(/s$/u, '')} stored under "${key}" says its id is "${value.id}".`,
        });
      }
    }
  });
}

export const siteLibrarySchema: z.ZodType<SiteLibrary> = z.strictObject({
  palette: z
    .array(paletteColorSchema)
    .max(LIBRARY_LIMITS.palette)
    .superRefine((palette, context) => {
      const seen = new Set<string>();
      palette.forEach((color, index) => {
        if (seen.has(color.id)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'id'],
            message: `Palette colour "${color.id}" is listed twice.`,
          });
        }
        seen.add(color.id);
      });
    })
    .optional(),
  styles: libraryRecord(namedStyleSchema, LIBRARY_LIMITS.styles, 'styles').optional(),
  symbols: libraryRecord(siteSymbolSchema, LIBRARY_LIMITS.symbols, 'symbols').optional(),
  templates: libraryRecord(savedTemplateSchema, LIBRARY_LIMITS.templates, 'templates').optional(),
  fonts: z
    .array(siteFontSchema)
    .max(LIBRARY_LIMITS.fonts)
    .superRefine((fonts, context) => {
      const seen = new Set<string>();
      fonts.forEach((font, index) => {
        const key = font.family.toLowerCase();
        if (seen.has(key)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'family'],
            message: `Font family "${font.family}" is listed twice.`,
          });
        }
        seen.add(key);
      });
    })
    .optional(),
  settings: siteLibrarySettingsSchema.optional(),
  // pixi-studio:schema-library additions (2026-10-10)
  scripts: libraryRecord(scriptEntrySchema, LIBRARY_LIMITS.scripts, 'scripts').optional(),
  sounds: libraryRecord(soundEntrySchema, LIBRARY_LIMITS.sounds, 'sounds').optional(),
  // end pixi-studio:schema-library additions
});

export type SiteLibraryValidationResult =
  | { ok: true; library: SiteLibrary }
  | { ok: false; issues: readonly { message: string; path: readonly (string | number)[] }[] };

/** Shape validation of a whole library (the door adds the class-vocabulary check). */
export function validateSiteLibrary(value: unknown): SiteLibraryValidationResult {
  const parsed = siteLibrarySchema.safeParse(value);
  if (parsed.success) return { ok: true, library: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.filter(
        (segment): segment is string | number =>
          typeof segment === 'string' || typeof segment === 'number',
      ),
    })),
  };
}

// ── Pure transforms shared by commands, the renderer and the panel ──────────

/**
 * An element's class list with every named-style marker expanded in place:
 * `twMerge(style utilities…, own utilities)`, so the element's own classes win
 * and combo styles apply in marker order (DESIGN D6). Markers naming a style
 * the library does not hold are dropped from the output, and `keep` lists the
 * style ids whose markers stay (detaching ONE style keeps the others).
 *
 * TODO(P4): switch to schema/style expandNamedStyles once the P1 engine lands
 * (it adds the logical-property conflict families tailwind-merge misses).
 */
export function expandNamedStyleMarkers(
  className: string,
  styles: Readonly<Record<LibraryId, NamedStyle>> | undefined,
  keep: ReadonlySet<LibraryId> = new Set(),
): string {
  const styleOf = (id: LibraryId): NamedStyle | undefined =>
    styles !== undefined && Object.hasOwn(styles, id) ? styles[id] : undefined;
  const markers: { id: LibraryId; token: string }[] = [];
  const own: string[] = [];
  for (const token of classTokens(className)) {
    const id = namedStyleIdOf(token);
    if (id === undefined) {
      own.push(token);
    } else {
      markers.push({ id, token });
    }
  }
  const kept: string[] = [];
  const expanded: string[] = [];
  markers.forEach(({ id, token }, index) => {
    if (keep.has(id)) {
      kept.push(token);
      return;
    }
    const style = styleOf(id);
    if (style === undefined) return;
    /*
      Exactness when some markers stay. Rendered, this style sat BEFORE every
      later marker and the element's own classes, so any of its utilities
      those override never showed. Inlined, it moves after the kept markers —
      so only its surviving utilities may come along, or a detach would
      repaint the element it promised to leave alone.
    */
    const later = [
      ...markers.slice(index + 1).map((marker) => styleOf(marker.id)?.className ?? ''),
      ...own,
    ].join(' ');
    const survivors = classTokens(style.className).filter((utility) =>
      classTokens(twMerge(`${utility} ${later}`)).includes(utility),
    );
    expanded.push(survivors.join(' '));
  });
  const merged = twMerge(...expanded, own.join(' '));
  return [...kept, merged].filter((part) => part !== '').join(' ');
}

function cloneNode(node: CustomCodeNode): CustomCodeNode {
  return structuredClone(node);
}

/**
 * The symbol's tree with one instance's overrides applied. Pure: the master is
 * never touched. An override whose path no longer resolves (the master was
 * edited since) is skipped, and an icon only takes a className.
 */
export function applySymbolOverrides(
  tree: CustomCodeRoot,
  overrides: readonly SymbolOverride[] | undefined,
): CustomCodeRoot {
  const next: CustomCodeRoot = { kind: 'root', children: tree.children.map(cloneNode) };
  for (const override of overrides ?? []) {
    let siblings: CustomCodeNode[] | undefined = next.children;
    let target: CustomCodeNode | undefined;
    for (const index of override.path) {
      target = siblings?.[index];
      siblings = target !== undefined && target.kind !== 'icon' ? target.children : undefined;
    }
    if (target === undefined || target.kind === 'component') continue;
    if (override.className !== undefined) target.className = override.className;
    if (target.kind !== 'element') continue;
    if (override.text !== undefined) target.text = override.text;
    if (override.attributes !== undefined) {
      const attributes: Record<string, string | undefined> = { ...target.attributes };
      for (const [name, value] of Object.entries(override.attributes)) {
        if (value === null) {
          delete attributes[name];
        } else {
          attributes[name] = value;
        }
      }
      target.attributes = attributes;
    }
  }
  return next;
}
