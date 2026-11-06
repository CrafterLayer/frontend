import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../builtins';
import { requestSkillIdsFor } from '../request-skills';
import { PEEK_CHARACTERS_ID, PEEK_CHARACTERS_SKILL } from './peek-characters';
import { pixiSkillIdsFor } from './pixi-selection';

const registry = createCraftkitAiSkillRegistry();

describe('peeking characters skill', () => {
  it('is registered as reviewed built-in data', () => {
    expect(registry.get(PEEK_CHARACTERS_ID)?.source).toBe('builtin');
    expect(PEEK_CHARACTERS_SKILL.instructions).toContain('A.peek(s,');
    expect(PEEK_CHARACTERS_SKILL.instructions).toContain('prefers-reduced-motion');
  });

  it.each([
    'Make an interactive story where a little fox is peeking over the dialogue box',
    'بدي قصة تفاعلية فيها قطة بتطل من فوق صندوق الحوار',
    'A 2d game with a mascot peeking over the score bar',
  ])('joins the creative set when a story or game asks for it: %s', (request) => {
    expect(pixiSkillIdsFor(registry, request)).toContain(PEEK_CHARACTERS_ID);
  });

  it('stays out of stories and games that never ask for a peek', () => {
    expect(pixiSkillIdsFor(registry, 'Create an interactive story in chapters')).not.toContain(
      PEEK_CHARACTERS_ID,
    );
    expect(pixiSkillIdsFor(registry, 'Make a playable 2d game with stars')).not.toContain(
      PEEK_CHARACTERS_ID,
    );
  });

  it.each([
    'A loading bar with a cute cat peeking over it',
    'شريط تقدم وفوقه قطة تطل',
  ])('reaches a plain section and the page plan: %s', (request) => {
    expect(
      requestSkillIdsFor(registry, request, 'section', { contractText: request, creative: false }),
    ).toContain(PEEK_CHARACTERS_ID);
    expect(requestSkillIdsFor(registry, request, 'page-plan')).toContain(PEEK_CHARACTERS_ID);
  });

  it('does not read a "sneak peek" section as a peeking character', () => {
    const request = 'Add a sneak peek section for our new collection';
    expect(requestSkillIdsFor(registry, request, 'page-plan')).not.toContain(PEEK_CHARACTERS_ID);
  });
});
