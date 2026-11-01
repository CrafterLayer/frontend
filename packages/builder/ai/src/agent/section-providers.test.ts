import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../skills/index';
import { pixiSkillIdsFor } from '../skills/creative/pixi-selection';
import type { SectionContract, SectionRole } from './page-plan/types';
import { creativeRequestOf, sceneBriefWordsOf } from './section-providers';

/*
  Every scene writer reads the request (2026-11-01). Only the hero's writer was matched on the
  person's words, so a later level or chapter scene lost what the person asked of the whole piece
  (physics, sound, a style) and was built from its own title and purpose alone. A TEXT section
  still never gets them: these words choose the Pixi playbooks, and a text band handed the
  request would turn into a scene.
*/

const REGISTRY = createCraftkitAiSkillRegistry();
const REQUEST =
  'A forest platformer starring Rumi the fox, with physics: crates stack and a ball knocks them down';
const OPTIONS = { request: REQUEST, skillRegistry: REGISTRY };

function section(title: string, purpose: string, role: SectionRole = 'band'): SectionContract {
  return {
    key: title.toLowerCase().replace(/[^a-z0-9]+/gu, '-'),
    role,
    title,
    anchorId: 'a',
    purpose,
    mustSay: [],
    mustNotRepeat: [],
  };
}

const LEVEL = section('Level 2', 'Level 2 — playable game: Rumi climbs the cliffs at dusk');

describe('creativeRequestOf — the words a section’s creative expertise is matched on', () => {
  it('hands a later scene section the person’s request, as it hands the hero', () => {
    const words = creativeRequestOf(OPTIONS, LEVEL);
    expect(words).toContain(REQUEST);
    // What that buys the writer: the request's own cues reach its playbooks.
    expect(pixiSkillIdsFor(REGISTRY, `${LEVEL.title} ${LEVEL.purpose}`)).not.toContain(
      'craftkit.pixi-physics',
    );
    expect(pixiSkillIdsFor(REGISTRY, words)).toContain('craftkit.pixi-physics');
    const hero = section('Rumi', 'The cover of the game', 'hero');
    expect(creativeRequestOf(OPTIONS, hero)).toContain(REQUEST);
  });

  it.each([
    ['How to play', 'Goal, keys and touch, scoring, how to win or lose.'],
    ['Credits and thanks', 'Who made it and the tools used.'],
    ['كيف تلعب', 'الهدف والأزرار والنقاط.'],
  ])('never hands it to a text section, so "%s" stays a text section', (title, purpose) => {
    const words = creativeRequestOf(OPTIONS, section(title, purpose));
    expect(words).not.toContain(REQUEST);
    expect(pixiSkillIdsFor(REGISTRY, words)).toEqual([]);
  });

  it('without a skill registry nothing is a scene but the hero', () => {
    expect(creativeRequestOf({ request: REQUEST }, LEVEL)).not.toContain(REQUEST);
  });

  it('plans each scene’s creative brief from its own words, the page request handed beside them', () => {
    // The brief's sectionRule lets a chapter's own words decide what it is (creative-planner.ts).
    expect(sceneBriefWordsOf(OPTIONS, LEVEL)).toBe(`${LEVEL.title} ${LEVEL.purpose}`);
    expect(sceneBriefWordsOf(OPTIONS, section('Rumi', 'The cover', 'hero'))).toContain(REQUEST);
  });
});
