/**
 * The art catalog (2026-10-14): brand logos (Simple Icons), cartoon
 * characters (DiceBear) and illustrations (Fluent Emoji Flat) as verified
 * DATA, so the agent names the art and never writes an image address.
 *
 * This barrel is the synchronous side only — what tools call while they
 * expand, and the load. The data, the search (find-art.ts) and the resolver
 * (art-spec.ts) belong to the lazy chunk that `loadArtCatalog()` imports
 * (catalog.ts): the section kit is on the playground's first load, and they
 * must not be. PROVENANCE.md records where the data came from.
 */
export {
  ART_CATALOG_LOADING,
  artKindOfUrl,
  DICEBEAR_API,
  FLUENT_EMOJI_API,
  isArtSpec,
  isVerifiedArtUrl,
  resolveArtImage,
  SIMPLE_ICONS_CDN,
  type ArtResolved,
  type ArtResolveOptions,
} from './runtime';
export { loadArtCatalog, planNamesArt } from './load';
export type {
  ArtCatalog,
  ArtImage,
  ArtKind,
  BrandEntry,
  DiceBearStyleEntry,
  EmojiEntry,
} from './types';
