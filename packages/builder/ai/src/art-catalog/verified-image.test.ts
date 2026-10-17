import { describe, expect, it } from 'vitest';

import { PHOTO_CATALOG } from '../context/providers/photo-catalog';
import { loadArtCatalog } from './load';
import { isVerifiedImageUrl } from './verified-image';

describe('isVerifiedImageUrl — what the section check admits unasked', () => {
  it('admits a catalog photo, and an art address only once the catalog has loaded', async () => {
    expect(isVerifiedImageUrl(PHOTO_CATALOG[0]?.url ?? '')).toBe(true);
    expect(isVerifiedImageUrl('https://cdn.simpleicons.org/visa')).toBe(false);
    await loadArtCatalog();
    expect(isVerifiedImageUrl('https://cdn.simpleicons.org/visa')).toBe(true);
    expect(isVerifiedImageUrl('https://cdn.simpleicons.org/no-such-brand-anywhere')).toBe(false);
    expect(isVerifiedImageUrl('https://images.unsplash.com/photo-1?w=1600')).toBe(false);
  });
});
