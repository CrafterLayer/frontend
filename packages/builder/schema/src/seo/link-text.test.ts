import { describe, expect, it } from 'vitest';

import { VAGUE_LINK_TEXT, isVagueLinkText } from './link-text';

describe('isVagueLinkText', () => {
  it('matches Arabic vague text through hamza and harakat variants', () => {
    expect(VAGUE_LINK_TEXT.ar).toContain('اقرأ المزيد');
    expect(isVagueLinkText('اقرا المزيد', 'ar')).toBe(true);
    expect(isVagueLinkText('  اضغطْ هنا ← ', 'ar')).toBe(true);
    expect(isVagueLinkText('اطلب قهوتك الآن', 'ar')).toBe(false);
  });

  it('matches the Lighthouse English list case- and punctuation-insensitively', () => {
    expect(isVagueLinkText('Read more →', 'en')).toBe(true);
    expect(isVagueLinkText('Click HERE!', 'en-GB')).toBe(true);
    expect(isVagueLinkText('See the full menu', 'en')).toBe(false);
    expect(isVagueLinkText('more')).toBe(true);
    expect(isVagueLinkText('', 'en')).toBe(false);
  });
});
