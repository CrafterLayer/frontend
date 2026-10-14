import { brandLogoUrl, characterUrl, hexColour, illustrationUrl, validSeed } from './art-url';
import { EXACT, findArt } from './find-art';
import { ART_SPEC, type ArtResolved, type ArtResolveOptions } from './runtime';
import type { ArtCatalog, ArtImage, DiceBearStyleEntry } from './types';

/**
 * Art specs: what the model writes where an image address goes (art catalog,
 * 2026-10-14). The model never writes these hosts' URLs; it names the art and
 * a tool resolves the name against the verified catalog:
 *
 * - `logo:<brand>` or `logo:<brand>/<colour>` — a Simple Icons logo, only for
 *   a brand the person named; a brand the catalog lacks is refused with a
 *   sentence asking the person to upload their logo.
 * - `character:<seed>`, `character:<style>:<seed>`, `…:<seed>:<background>` —
 *   a DiceBear cartoon; the same seed draws the same person every time.
 * - `illustration:<name or words>` — a Fluent Emoji Flat picture («طبيب»,
 *   "coffee", "rocket").
 *
 * Alt text is written in the page language; the call's own alt wins for a
 * character or an illustration (it knows who and what), never for a logo
 * (the alt is the brand's name).
 */

export type ArtSpec =
  | { readonly kind: 'logo'; readonly brand: string; readonly colour?: string | undefined }
  | {
      readonly kind: 'character';
      readonly style?: string | undefined;
      readonly seed: string;
      readonly background?: string | undefined;
    }
  | { readonly kind: 'illustration'; readonly words: string };

export type { ArtResolved } from './runtime';

const MAX_BRAND = 60;
const MAX_WORDS = 80;
/** A picture's box: square, the size a card or a logo row draws it at. */
const SIZE = 256;
const DEFAULT_STYLE = 'notionists';

function fail(error: string): { readonly ok: false; readonly error: string } {
  return { ok: false, error };
}

/** Read an art spec; a malformed one is refused with the shape it should have. */
export function parseArtSpec(value: string): ArtResolved<ArtSpec> {
  const match = ART_SPEC.exec(value);
  if (match === null)
    return fail(
      `"${value.slice(0, 40)}" is not 'logo:<brand>', 'character:<style>:<seed>' or 'illustration:<words>'.`,
    );
  const kind = (match[1] ?? '').toLowerCase();
  const rest = (match[2] ?? '').trim();
  if (kind === 'logo') {
    const [brand = '', colour] = rest.split('/').map((part) => part.trim());
    if (brand === '' || brand.length > MAX_BRAND)
      return fail("'logo:<brand>' names the brand, e.g. 'logo:stripe' or 'logo:visa/white'.");
    if (colour !== undefined && hexColour(colour) === undefined) {
      return fail(`'logo:${brand}/${colour}': the colour is white, black or a hex such as ffffff.`);
    }
    return {
      ok: true,
      value: { kind: 'logo', brand, ...(colour === undefined ? {} : { colour }) },
    };
  }
  if (kind === 'character') {
    const parts = rest.split(':').map((part) => part.trim());
    const [first = '', second, third] = parts;
    const [style, seed, background] =
      parts.length === 1 ? [undefined, first, undefined] : [first, second ?? '', third];
    if (parts.length > 3 || !validSeed(seed)) {
      return fail(
        "'character:<style>:<seed>' — the seed is 1-64 characters (a name: the same seed draws the same person).",
      );
    }
    if (background !== undefined && hexColour(background) === undefined) {
      return fail(`'character:…:${background}': the background is a hex colour such as f4e3d7.`);
    }
    return {
      ok: true,
      value: {
        kind: 'character',
        ...(style === undefined ? {} : { style: style.toLowerCase() }),
        seed,
        ...(background === undefined ? {} : { background }),
      },
    };
  }
  if (rest === '' || rest.length > MAX_WORDS)
    return fail(
      "'illustration:<words>' names what it shows, e.g. 'illustration:doctor' or 'illustration:قهوة'.",
    );
  return { ok: true, value: { kind: 'illustration', words: rest } };
}

function arabic(locale: string): boolean {
  return locale.trim().toLowerCase().startsWith('ar');
}

function givenAlt(alt: string | undefined): string | undefined {
  const text = alt?.replace(/\s+/gu, ' ').trim();
  return text === undefined || text === '' ? undefined : text.slice(0, 250);
}

function styleList(styles: readonly DiceBearStyleEntry[]): string {
  return styles.map(({ id }) => id).join(', ');
}

function resolveLogo(
  spec: Extract<ArtSpec, { kind: 'logo' }>,
  locale: string,
  catalog: ArtCatalog,
): ArtResolved<ArtImage> {
  const matches = findArt(spec.brand, 'logo', catalog);
  const best = matches[0];
  const brand =
    best?.score === EXACT ? catalog.brands.find(({ slug }) => slug === best.id) : undefined;
  if (brand === undefined) {
    const near = matches.slice(0, 3).map(({ title }) => title);
    return fail(
      `no verified logo for "${spec.brand}"${near.length === 0 ? '' : ` (did you mean ${near.join(', ')}?)`}; write the name as text and ask the person to upload their logo.`,
    );
  }
  return {
    ok: true,
    value: {
      kind: 'logo',
      src: brandLogoUrl(brand.slug, spec.colour),
      alt: arabic(locale) ? `شعار ${brand.title}` : `${brand.title} logo`,
      width: SIZE,
      height: SIZE,
    },
  };
}

function resolveCharacter(
  spec: Extract<ArtSpec, { kind: 'character' }>,
  locale: string,
  alt: string | undefined,
  catalog: ArtCatalog,
): ArtResolved<ArtImage> {
  const id = spec.style ?? DEFAULT_STYLE;
  const style = catalog.styles.find((entry) => entry.id === id);
  if (style === undefined) {
    const near = findArt(id, 'character', catalog).filter(({ score }) => score >= EXACT / 2);
    return fail(
      `"${id}" is not a character style${near.length === 0 ? '' : ` (closest: ${near.map((match) => match.id).join(', ')})`}; use one of ${styleList(catalog.offeredStyles)}.`,
    );
  }
  if (style.attribution) {
    return fail(
      `"${style.id}" (${style.title} by ${style.creator}) is ${style.licence} and needs a visible credit the page has no place for; use one of ${styleList(catalog.offeredStyles)}.`,
    );
  }
  return {
    ok: true,
    value: {
      kind: 'character',
      src: characterUrl(style.id, spec.seed, spec.background),
      alt: givenAlt(alt) ?? (arabic(locale) ? 'صورة رمزية كرتونية' : 'Cartoon avatar'),
      width: SIZE,
      height: SIZE,
    },
  };
}

/** `name`, or `name-<tone>` for a person who comes in skin tones. */
function exactEmoji(words: string, catalog: ArtCatalog): string | undefined {
  const name = words.trim().toLowerCase();
  if (catalog.emojiByName.has(name)) return name;
  const tone = /^(.+?)-(medium-light|medium-dark|light|medium|dark)$/u.exec(name);
  return tone !== null && catalog.toned.has(tone[1] ?? '') ? name : undefined;
}

function resolveIllustration(
  spec: Extract<ArtSpec, { kind: 'illustration' }>,
  locale: string,
  alt: string | undefined,
  catalog: ArtCatalog,
): ArtResolved<ArtImage> {
  const name =
    exactEmoji(spec.words, catalog) ?? findArt(spec.words, 'illustration', catalog)[0]?.id;
  if (name === undefined) {
    return fail(
      `no illustration matches "${spec.words}"; name a plainer thing such as doctor, coffee, car, rocket, house or gift.`,
    );
  }
  const base = name.replace(/-(?:medium-light|medium-dark|light|medium|dark)$/u, '');
  const label = arabic(locale)
    ? (catalog.words.arabicLabels.get(name) ?? catalog.words.arabicLabels.get(base))
    : `${name.charAt(0).toUpperCase()}${name.slice(1).replaceAll('-', ' ')}`;
  const text = givenAlt(alt) ?? label;
  if (text === undefined)
    return fail(
      `'illustration:${spec.words}' needs "alt": say what it shows, in the page's language.`,
    );
  return {
    ok: true,
    value: {
      kind: 'illustration',
      src: illustrationUrl(name),
      alt: text,
      width: SIZE,
      height: SIZE,
    },
  };
}

/** An art spec resolved against the loaded catalog (installed in runtime.ts by load.ts). */
export function resolveArtImageIn(
  catalog: ArtCatalog,
  value: string,
  options: ArtResolveOptions,
): ArtResolved<ArtImage> {
  const spec = parseArtSpec(value);
  if (!spec.ok) return spec;
  switch (spec.value.kind) {
    case 'logo':
      return resolveLogo(spec.value, options.locale, catalog);
    case 'character':
      return resolveCharacter(spec.value, options.locale, options.alt, catalog);
    case 'illustration':
      return resolveIllustration(spec.value, options.locale, options.alt, catalog);
  }
}
