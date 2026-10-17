import type { ArtImage } from './types';

/**
 * The art catalog's synchronous face (art catalog, 2026-10-14): what the
 * tools call while they expand. It holds no data and no resolver — the
 * section kit is part of the playground's first load, and the brands, styles
 * and illustrations must not be. `loadArtCatalog()` (load.ts) installs the
 * resolver when the catalog arrives; until then an art spec is refused with
 * a sentence to send the step again.
 */

export const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';
export const DICEBEAR_API = 'https://api.dicebear.com/9.x';
export const FLUENT_EMOJI_API = 'https://api.iconify.design/fluent-emoji-flat';

/** `logo:…`, `character:…`, `illustration:…` — an art spec where an address would go. */
export const ART_SPEC = /^\s*(logo|character|illustration)\s*:\s*([\s\S]*)$/iu;

export type ArtResolved<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export interface ArtResolveOptions {
  /** The page language: alt text is written in it. */
  readonly locale: string;
  /** The call's own alt (a character's or an illustration's; never a logo's). */
  readonly alt?: string | undefined;
}

/** What the loaded catalog provides. */
export interface ArtRuntime {
  readonly resolve: (value: string, options: ArtResolveOptions) => ArtResolved<ArtImage>;
  readonly verify: (url: string) => boolean;
}

let runtime: ArtRuntime | undefined;

/** Installed by `loadArtCatalog()` once the catalog has loaded. */
export function setArtRuntime(next: ArtRuntime): void {
  runtime = next;
}

export const ART_CATALOG_LOADING = 'the art catalog is still loading; send the same step again.';

/** Whether a value is an art spec rather than an address. */
export function isArtSpec(value: unknown): boolean {
  return typeof value === 'string' && ART_SPEC.test(value);
}

/** An art spec as a verified picture, or a refusal that names the fix. */
export function resolveArtImage(value: string, options: ArtResolveOptions): ArtResolved<ArtImage> {
  return runtime?.resolve(value, options) ?? { ok: false, error: ART_CATALOG_LOADING };
}

/**
 * Whether an image address is one the art catalog would write — the brand,
 * style or illustration checked against the data, never the host alone —
 * for a plan guard that admits only verified pictures. False before the load.
 */
export function isVerifiedArtUrl(url: string): boolean {
  return runtime?.verify(url) ?? false;
}

/** Which catalog host an address is on, if any (a logo or an illustration is drawn contained, not cropped). */
export function artKindOfUrl(url: string): 'logo' | 'character' | 'illustration' | undefined {
  if (url.startsWith(`${SIMPLE_ICONS_CDN}/`)) return 'logo';
  if (url.startsWith(`${DICEBEAR_API}/`)) return 'character';
  if (url.startsWith(`${FLUENT_EMOJI_API}/`)) return 'illustration';
  return undefined;
}
