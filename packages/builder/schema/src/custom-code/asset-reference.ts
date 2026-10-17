import type { AssetId } from '../assets/types';

/*
  ── Asset references inside a custom-code tree (fix pass, style-manager P9) ──
  A tree attribute is capped at 2000 characters, so an uploaded picture (a
  data URL) cannot be written into an <img src>. The tree stores a reference
  instead — `/ck-assets/<id>`, a relative address the door already admits —
  and every render (canvas, preview, export) resolves it through the site's
  asset table. Deleting a referenced asset is refused like a block's
  `{assetId}` (findAssetUsages).
*/

/** The address prefix a tree uses to name an entry of the site's asset table. */
export const CUSTOM_CODE_ASSET_PREFIX = '/ck-assets/';

/** The tree address for one asset (`/ck-assets/<id>`). */
export function customCodeAssetSrc(id: AssetId): string {
  return `${CUSTOM_CODE_ASSET_PREFIX}${encodeURIComponent(id)}`;
}

/** The asset id a tree address names, or undefined when it names none. */
export function customCodeAssetId(src: string): AssetId | undefined {
  const trimmed = src.trim();
  if (!trimmed.startsWith(CUSTOM_CODE_ASSET_PREFIX)) return undefined;
  const raw = trimmed.slice(CUSTOM_CODE_ASSET_PREFIX.length);
  if (raw === '' || raw.includes('/')) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}
