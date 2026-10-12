import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../index';
import {
  CREATIVE_ANIMATION_EXAMPLE,
  CREATIVE_DIALOGUE_EXAMPLE,
  CREATIVE_EFFECTS_EXAMPLE,
  CREATIVE_ENGINE_SKILLS,
  CREATIVE_INK_EXAMPLE,
  CREATIVE_TILEMAP_EXAMPLE,
} from './creative-engines';
import { pixiSkillIdsFor } from './pixi-selection';
import { pixiSkillExamples } from './pixi-v8';

const ANIM = 'craftkit.pixi-animation';
const FX = 'craftkit.pixi-effects';
const DIALOGUE = 'craftkit.pixi-dialogue';
const TILES = 'craftkit.pixi-tile-worlds';
const DIRECTOR = 'craftkit.pixi-director';
const PAGE_SHAPES = 'craftkit.pixi-page-shapes';

function activeIds(request: string): readonly string[] {
  return createCraftkitAiSkillRegistry()
    .prepare({ request })
    .active.map(({ id }) => id);
}

describe('creative engine skills — activation', () => {
  it.each([
    ['A platformer where a fox collects stars', TILES],
    ['اعمل لعبة منصات فيها قفز وعملات', TILES],
    ['بدي لعبة متاهة للأطفال', TILES],
    ['A visual novel with branching dialogue', DIALOGUE],
    ['بدي رواية مرئية فيها حوار تفاعلي', DIALOGUE],
    ['Character animation for a cartoon character', ANIM],
    ['بدي شخصيات متحركة ورسوم متحركة', ANIM],
    ['Add particle effects and weather effects to the scene', FX],
    ['ضيف مؤثرات بصرية وتأثيرات سحرية', FX],
  ])('activates %s', (request, expected) => {
    expect(activeIds(request)).toEqual(expect.arrayContaining(['craftkit.pixi-v8-core', expected]));
  });

  it.each([
    'Build an animated landing page for our agency',
    'Tell our company story with a timeline',
    'صمم صفحة هبوط متحركة لشركتي',
    'Add a dialogue box to the contact form',
    'اكتب قصة نجاح العميل',
    'Create a game store website',
  ])('stays out of %s', (request) => {
    expect(
      activeIds(request).filter((id) => CREATIVE_ENGINE_SKILLS.some((skill) => skill.id === id)),
    ).toEqual([]);
  });

  it('keeps the director explicit and every engine data-only with the core dependency', () => {
    for (const skill of CREATIVE_ENGINE_SKILLS.filter(({ id }) => id !== PAGE_SHAPES)) {
      expect(skill.dependencies).toEqual(['craftkit.pixi-v8-core']);
      expect(skill.restrictToCommands).toBeUndefined();
      expect(skill.instructions).toMatch(/Free code OFF|PLAN BEFORE CODE/u);
    }
    expect(CREATIVE_ENGINE_SKILLS.find(({ id }) => id === DIRECTOR)?.activation).toEqual({
      mode: 'explicit',
    });
    // The page planner writes no scene code: explicit, no dependency, no command restriction.
    expect(CREATIVE_ENGINE_SKILLS.find(({ id }) => id === PAGE_SHAPES)).toMatchObject({
      activation: { mode: 'explicit' },
    });
    expect(CREATIVE_ENGINE_SKILLS.find(({ id }) => id === PAGE_SHAPES)?.dependencies).toBe(
      undefined,
    );
  });
});

describe('creative selection lane', () => {
  const registry = createCraftkitAiSkillRegistry();

  it('brings the director and engine companions with a game', () => {
    const ids = pixiSkillIdsFor(registry, 'بدي لعبة تجمع فيها نجوم');
    expect(ids.slice(0, 2)).toEqual(['craftkit.pixi-games', DIRECTOR]);
    expect(ids).toEqual(expect.arrayContaining([FX, ANIM]));
  });

  it('brings dialogue and animation with a story', () => {
    const ids = pixiSkillIdsFor(registry, 'Create an interactive story about a traveller');
    expect(ids).toEqual(
      expect.arrayContaining(['craftkit.pixi-stories', DIRECTOR, DIALOGUE, ANIM]),
    );
  });

  it('brings the game playbook with a platformer', () => {
    expect(pixiSkillIdsFor(registry, 'A platformer level')).toEqual(
      expect.arrayContaining([TILES, 'craftkit.pixi-games', DIRECTOR]),
    );
  });

  it('adds nothing for ordinary pages and nothing absent from the registry', () => {
    expect(pixiSkillIdsFor(registry, 'Build a game studio landing page')).toEqual([]);
    expect(pixiSkillIdsFor(undefined, 'A platformer level')).toEqual([]);
  });

  it('every selected skill fits a writer budget together with its dependencies', () => {
    const ids = pixiSkillIdsFor(registry, 'Create an interactive story about a traveller');
    const prepared = registry.prepare({
      request: '',
      auto: false,
      selectedSkillIds: ids.slice(0, 4),
    });
    expect(prepared.omitted).toEqual([]);
    expect(prepared.totalTokens).toBeLessThan(12_000);
  });
});

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* The plain JS scene-body contract. */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

describe('creative engine skills — examples are exact scene bodies', () => {
  const examples = [
    { id: ANIM, code: [CREATIVE_ANIMATION_EXAMPLE] },
    { id: FX, code: [CREATIVE_EFFECTS_EXAMPLE] },
    { id: DIALOGUE, code: [CREATIVE_DIALOGUE_EXAMPLE, CREATIVE_INK_EXAMPLE] },
    { id: TILES, code: [CREATIVE_TILEMAP_EXAMPLE] },
  ];

  it.each(examples)('$id compiles, names its libraries literally and disposes', ({ code }) => {
    for (const body of code) {
      expect(() => new AsyncFunction('ck', body)).not.toThrow();
      expect(body).toMatch(/ck\.scene\(\{[^}]*libs:\['[a-z]+'/u);
      expect(body).toContain('s.dispose(');
      expect(body).not.toMatch(
        /new P(?:IXI)?\.Application|\bimport\s*\(|https?:\/\/|window\.add|document\.add/u,
      );
    }
  });

  it.each(examples)('$id teaches exactly its exported examples', ({ id, code }) => {
    const skill = CREATIVE_ENGINE_SKILLS.find((candidate) => candidate.id === id);
    expect(skill).toBeDefined();
    if (skill !== undefined)
      expect(pixiSkillExamples(skill)).toEqual(code.map((body) => body.replace(/\n\s*/gu, ' ')));
  });

  it('keeps Ink source line breaks after inlining', () => {
    const inline = CREATIVE_INK_EXAMPLE.replace(/\n\s*/gu, ' ');
    expect(inline).toContain('\\n* [Count the stars]');
  });
});
