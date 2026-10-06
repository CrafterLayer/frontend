import { describe, expect, it } from 'vitest';

import { SECTION_KITS } from '@craftkit/builder';

import { librarySections } from './library-sections';

describe('librarySections (the Library Sections tab, fix pass)', () => {
  it('fills every section kit in both languages, as a region tree', () => {
    for (const lang of ['en', 'ar'] as const) {
      const sections = librarySections(lang);
      expect(sections).toHaveLength(SECTION_KITS.length);
      for (const section of sections) {
        expect(section.tree.kind).toBe('root');
        expect(section.tree.children.length).toBeGreaterThan(0);
      }
    }
    expect(librarySections('ar')[0]?.group).toMatch(/[؀-ۿ]/u);
  });
});
