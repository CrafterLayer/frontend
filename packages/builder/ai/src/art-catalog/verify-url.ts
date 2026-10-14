import { DICEBEAR_API, FLUENT_EMOJI_API, SIMPLE_ICONS_CDN } from './runtime';
import type { ArtCatalog } from './types';

/**
 * Whether an image address is one the art catalog would write (art catalog,
 * 2026-10-14): a Simple Icons logo of a brand the index holds, a DiceBear
 * character in a style a page may use without a credit, a Fluent Emoji the
 * set holds. The host alone is never enough — `cdn.simpleicons.org/anything`
 * written from memory answers false — and so is an address read before the
 * catalog loaded (runtime.ts). For a plan guard that admits only verified pictures.
 */

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');
const LOGO = new RegExp(`^${escape(SIMPLE_ICONS_CDN)}/([a-z0-9_]+)(?:/[0-9a-f]{6})?$`, 'u');
const CHARACTER = new RegExp(
  `^${escape(DICEBEAR_API)}/([a-z]+(?:-[a-z]+)*)/svg\\?seed=[^&#\\s]+(?:&backgroundColor=[0-9a-f]{6})?$`,
  'u',
);
const ILLUSTRATION = new RegExp(
  `^${escape(FLUENT_EMOJI_API)}/([a-z0-9]+(?:-[a-z0-9]+)*)\\.svg$`,
  'u',
);
const TONE = /^(.+?)-(?:medium-light|medium-dark|light|medium|dark)$/u;

export function isVerifiedArtUrlIn(catalog: ArtCatalog, url: string): boolean {
  const address = url.replaceAll('&amp;', '&').trim();
  const logo = LOGO.exec(address)?.[1];
  if (logo !== undefined) return catalog.brands.some(({ slug }) => slug === logo);
  const style = CHARACTER.exec(address)?.[1];
  if (style !== undefined) return catalog.offeredStyles.some(({ id }) => id === style);
  const name = ILLUSTRATION.exec(address)?.[1];
  if (name === undefined) return false;
  return catalog.emojiByName.has(name) || catalog.toned.has(TONE.exec(name)?.[1] ?? '');
}
