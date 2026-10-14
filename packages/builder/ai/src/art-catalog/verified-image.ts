import { isCatalogPhotoUrl } from '../context/providers/photo-catalog';
import { isVerifiedArtUrl } from './runtime';

/**
 * Whether an image address is a verified picture (art catalog, 2026-10-14): a
 * catalog photo, or a logo, character or illustration the art catalog would
 * write. The section check admits these without the request naming them.
 */
export function isVerifiedImageUrl(url: string): boolean {
  return isCatalogPhotoUrl(url) || isVerifiedArtUrl(url);
}
