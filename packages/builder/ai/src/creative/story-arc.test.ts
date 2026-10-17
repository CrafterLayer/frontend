/**
 * The story arc (T231c, 2026-10-12): every scene writer of a page with several scenes sees them
 * all in order, its own marked, with the parts on either side. Ours to prove: the rendering
 * (order, mark, place, long purposes cut), no arc for a lone scene or a stranger, and the seam —
 * a page plan's scene writers get the arc, its ordinary writers and a one-scene page do not.
 */
import { describe, expect, it } from 'vitest';

import { sectionProviders } from '../agent/section-providers';
import type { PagePlan, SectionContract } from '../agent/page-plan/types';
import type { RunAiBuildOptions } from '../agent/types';
import { createCraftkitAiSkillRegistry } from '../skills';
import { renderStoryArc, STORY_ARC_PROVIDER_ID, type StoryArcSection } from './story-arc';

const LANTERN: StoryArcSection = {
  key: 'lantern',
  title: 'The lantern goes out',
  purpose: 'Layla loses her light at the river.',
};
const RIVER: StoryArcSection = {
  key: 'river',
  title: 'The river',
  purpose: 'She crosses at night.',
};
const DAWN: StoryArcSection = { key: 'dawn', title: 'Dawn', purpose: '' };

describe('renderStoryArc', () => {
  it('lists the scenes in order, marks the one being written and says where it sits', () => {
    expect(renderStoryArc([LANTERN, RIVER, DAWN], 'river')).toBe(
      [
        'The scenes on this page, in order (▶ marks the one being written):',
        '  1. The lantern goes out — Layla loses her light at the river.',
        '▶ 2. The river — She crosses at night.',
        '  3. Dawn',
        'Part 2 of 3. It follows "The lantern goes out". It leads into "Dawn". The cast, setting, palette and voice are shared by every part; each part tells its own events.',
      ].join('\n'),
    );
    expect(renderStoryArc([LANTERN, RIVER], 'lantern')).toContain('It opens the arc.');
    expect(renderStoryArc([LANTERN, RIVER], 'river')).toContain('It ends the arc.');
  });

  it('keeps a line of a long purpose', () => {
    const long = { ...RIVER, purpose: 'word '.repeat(100) };
    const arc = renderStoryArc([LANTERN, long], 'lantern') ?? '';
    expect(arc.split('\n')[2]?.length).toBeLessThan(220);
    expect(arc).toContain('…');
  });

  it('has no arc for a lone scene or a section that is not one', () => {
    expect(renderStoryArc([LANTERN], 'lantern')).toBeUndefined();
    expect(renderStoryArc([LANTERN, RIVER], 'contact')).toBeUndefined();
  });
});

function contract(key: string, title: string, purpose: string): SectionContract {
  return {
    key,
    role: 'feature',
    title,
    anchorId: key,
    purpose,
    mustSay: [],
    mustNotRepeat: [],
  } as unknown as SectionContract;
}

const [CHAPTER_ONE, CHAPTER_TWO] = [
  contract(
    'ch-1',
    'Chapter 1: the lantern',
    'An animated Pixi story scene: Layla loses her lantern.',
  ),
  contract('ch-2', 'Chapter 2: the river', 'An animated Pixi story scene: she crosses the river.'),
];
const CONTACT = contract('contact', 'Contact', 'Our phone number and opening hours.');

function plan(sections: readonly SectionContract[]): PagePlan {
  return { locale: { lang: 'en', dir: 'ltr' }, sections } as unknown as PagePlan;
}

const OPTIONS = {
  request: 'A bedtime story with animated Pixi scenes, two chapters',
  freeCode: true,
  skillRegistry: createCraftkitAiSkillRegistry(),
  kernel: { context: { registry: { aiContextProviders: () => [] } } },
} as unknown as RunAiBuildOptions;

const arcOf = (sections: readonly SectionContract[], current: SectionContract) =>
  sectionProviders(OPTIONS, plan(sections), current).find(({ id }) => id === STORY_ARC_PROVIDER_ID);

describe('sectionProviders and the arc', () => {
  it('gives every scene writer the arc, and the ordinary writer none', () => {
    const page = [CHAPTER_ONE, CHAPTER_TWO, CONTACT];
    const second = arcOf(page, CHAPTER_TWO);
    const body = second?.collect({} as never, []).body ?? '';
    expect(body).toContain('▶ 2. Chapter 2: the river');
    expect(body).not.toContain('Contact');
    expect(arcOf(page, CONTACT)).toBeUndefined();
  });

  it('has no arc on a page with one scene', () => {
    expect(arcOf([CHAPTER_ONE, CONTACT], CHAPTER_ONE)).toBeUndefined();
  });
});
