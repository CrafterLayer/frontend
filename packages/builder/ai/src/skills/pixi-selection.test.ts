import { describe, expect, it } from 'vitest';
import { createCraftkitAiSkillRegistry } from './builtins';
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
});
