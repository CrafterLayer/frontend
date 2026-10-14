import { DICEBEAR_API, FLUENT_EMOJI_API, SIMPLE_ICONS_CDN } from './runtime';

/**
 * The three hosts the art catalog's pictures load from, and the only way an
 * address for them is written (art catalog, 2026-10-14). Every builder takes
 * a value the catalog has already verified (a slug, a style id, an emoji
 * name) and checks its shape again, so a malformed one can never become a
 * path segment; a seed — free text — is percent-encoded.
 */

const SLUG = /^[a-z0-9_]+$/u;
const STYLE = /^[a-z]+(?:-[a-z]+)*$/u;
const EMOJI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const NAMED_COLOURS: Readonly<Record<string, string>> = { white: 'ffffff', black: '000000' };
/** A seed is a name or a short label: at most this many characters, no control characters. */
export const MAX_SEED = 64;

/** `#fff`, `FFFFFF`, `white` → `ffffff`; undefined for anything else. */
export function hexColour(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  const named = NAMED_COLOURS[text];
  if (named !== undefined) return named;
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/u.exec(text)?.[1];
  if (hex === undefined) return undefined;
  return hex.length === 3 ? hex.replace(/./gu, (digit) => digit + digit) : hex;
}

/** A Simple Icons logo in its brand colour, or in `colour` (six hex digits). */
export function brandLogoUrl(slug: string, colour?: string): string {
  if (!SLUG.test(slug)) throw new Error(`not a Simple Icons slug: ${slug}`);
  const hex = colour === undefined ? undefined : hexColour(colour);
  if (colour !== undefined && hex === undefined) throw new Error(`not a colour: ${colour}`);
  return hex === undefined ? `${SIMPLE_ICONS_CDN}/${slug}` : `${SIMPLE_ICONS_CDN}/${slug}/${hex}`;
}

/** Whether a seed may name a character: 1-64 characters, none of them control characters. */
export function validSeed(seed: string): boolean {
  const chars = Array.from(seed.trim());
  return chars.length > 0 && chars.length <= MAX_SEED && !/[\u0000-\u001f\u007f]/u.test(seed);
}

/** A DiceBear character: the same seed draws the same face every time. */
export function characterUrl(style: string, seed: string, background?: string): string {
  if (!STYLE.test(style)) throw new Error(`not a DiceBear style id: ${style}`);
  if (!validSeed(seed)) throw new Error('a seed is 1-64 characters of text');
  const hex = background === undefined ? undefined : hexColour(background);
  if (background !== undefined && hex === undefined) throw new Error(`not a colour: ${background}`);
  const query = `seed=${encodeURIComponent(seed.trim())}${hex === undefined ? '' : `&backgroundColor=${hex}`}`;
  return `${DICEBEAR_API}/${style}/svg?${query}`;
}

/** A Fluent Emoji Flat illustration. */
export function illustrationUrl(name: string): string {
  if (!EMOJI.test(name)) throw new Error(`not a Fluent Emoji name: ${name}`);
  return `${FLUENT_EMOJI_API}/${name}.svg`;
}
