import { describe, expect, it } from 'vitest';
import { createCraftkitAiSkillRegistry } from '../builtins';
import { pixiSkillIdsFor } from './pixi-selection';

describe('targeted Pixi expertise for explicit build lanes', () => {
  it.each([
    ['Make a playable 2d game with stars', 'craftkit.pixi-games'],
    ['بدي لعبة تجمع فيها نجوم', 'craftkit.pixi-games'],
    ['Create an interactive story in chapters', 'craftkit.pixi-stories'],
    ['بدي قصة تفاعلية بثلاث فصول', 'craftkit.pixi-stories'],
    ['Design a layered mural', 'craftkit.pixi-murals'],
    ['بدي جدارية تفاعلية', 'craftkit.pixi-murals'],
  ])('selects only available expertise for %s', (request, expected) => {
    const ids = pixiSkillIdsFor(createCraftkitAiSkillRegistry(), request);
    expect(ids).toContain(expected);
    expect(ids.every((id) => id.startsWith('craftkit.pixi-'))).toBe(true);
  });

  it.each([
    'Build a game studio landing page',
    'Create a game store website',
    'Make a game studio portfolio',
    'بدي موقع لمتجر ألعاب',
    'Tell our business story',
  ])('does not leak creative expertise into %s', (request) => {
    expect(pixiSkillIdsFor(createCraftkitAiSkillRegistry(), request)).toEqual([]);
  });

  it('does not create skills absent from the host registry', () => {
    expect(pixiSkillIdsFor(undefined, 'Make a playable 2d game')).toEqual([]);
  });

  it('automatically brings scroll, character and drawing expertise from an Arabic mural brief', () => {
    const ids = pixiSkillIdsFor(
      createCraftkitAiSkillRegistry(),
      'سوي الي جدارية افقية بواسطة سكرول مع شخصيات تتحرك بالماوس وجو بالليل',
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        'craftkit.pixi-murals',
        'craftkit.pixi-scroll-murals',
        'craftkit.pixi-director',
        'craftkit.pixi-animation',
        'craftkit.pixi-effects',
        'craftkit.pixi-v8-graphics',
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps disabled or absent companion expertise out of the selection', () => {
    const registry = createCraftkitAiSkillRegistry();
    const enabled = {
      ...registry,
      get: (id: string) => (id === 'craftkit.pixi-animation' ? undefined : registry.get(id)),
    };
    expect(pixiSkillIdsFor(enabled, 'Design a mural with characters')).not.toContain(
      'craftkit.pixi-animation',
    );
    expect(pixiSkillIdsFor(registry, 'Change the characters in a company headline')).toEqual([]);
  });
});
