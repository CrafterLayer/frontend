import { emptyCreativeMemory, type CreativeMemoryV1 } from '@craftkit/builder';

/**
 * Story bibles for StoryBiblePanel's stories and tests (creative agent, 2026-10-12): what a
 * bible holds after the Agent wrote a branching forest story — learned cast, a portrait, a
 * background and the person's own canon facts — in English and in Arabic.
 */
export const STORY_BIBLES: Readonly<Record<'en' | 'ar' | 'empty', CreativeMemoryV1>> = {
  en: {
    schemaVersion: 1,
    characters: [
      { id: 'layla', name: 'Layla', role: 'hero', color: '#f59e0b', traits: ['brave', 'curious'] },
      { id: 'omar', name: 'Omar', role: 'friend', color: '#38bdf8' },
    ],
    assets: [
      { id: 'layla-png', kind: 'portrait', url: 'assets/layla.png', owner: 'layla' },
      { id: 'forest-webp', kind: 'image', url: 'assets/forest.webp' },
    ],
    locations: [{ id: 'forest', name: 'forest' }],
    facts: ['Layla lost her lantern by the river.', 'Omar is afraid of deep water.'],
  },
  ar: {
    schemaVersion: 1,
    characters: [
      { id: 'ليلى', name: 'ليلى', role: 'البطلة', color: '#f59e0b' },
      { id: 'عمر', name: 'عمر', role: 'الصديق', color: '#38bdf8' },
    ],
    assets: [{ id: 'forest-webp', kind: 'background', url: 'assets/forest.webp' }],
    locations: [{ id: 'الغابة', name: 'الغابة' }],
    facts: ['فقدت ليلى فانوسها عند النهر.'],
  },
  empty: emptyCreativeMemory(),
};
