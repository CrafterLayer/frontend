import { describe, expect, it } from 'vitest';

import { PRESETS_SET_F } from '../../scene-presets/set-f';
import { createCraftkitAiSkillRegistry } from '../index';
import { CREATIVE_ANIMATION_SKILL } from './creative-engines';
import { PIXI_MURAL_SKILL } from './pixi-creative';
import { CREATIVE_SCROLL_MURAL_SKILL } from './scene-engines';

/*
  Mural stories (2026-10-14): a mural that tells a story — «قصص جدارية», illustrated vignettes of
  people, animals and places told in beats — brings the scroll-mural playbook's MURAL STORY lines
  beside the mural playbook, which names the four set-F stories first; the anim playbook teaches
  the timeline controls a story scrubs with. All of it inside the budgets every playbook keeps.
*/

const REGISTRY = createCraftkitAiSkillRegistry();
const MURAL = PIXI_MURAL_SKILL.id;
const SCROLL = CREATIVE_SCROLL_MURAL_SKILL.id;
const STORY_IDS = PRESETS_SET_F.map(([entry]) => entry.id);

function prepared(request: string) {
  return REGISTRY.prepare({ request });
}

describe('mural story playbooks', () => {
  it.each([
    'جدارية تحكي قصة قافلة في الصحراء',
    'اعمل قصة جدارية عن قرية الصيادين',
    'بدي قصص جدارية للسوق القديم',
    'A mural story about a seed that becomes a forest',
    'An illustrated mural of a fishing village',
  ])('brings the mural and the mural-story lines for "%s", nothing omitted', (request) => {
    const result = prepared(request);
    const ids = result.active.map(({ id }) => id);
    expect(ids).toEqual(expect.arrayContaining([MURAL, SCROLL]));
    expect(result.omitted).toEqual([]);
  });

  it('keeps the widest Pixi request free of the mural-story lines', () => {
    const ids = prepared('an interactive mural in PixiJS with particles and sprites').active.map(
      ({ id }) => id,
    );
    expect(ids).toContain(MURAL);
    expect(ids).not.toContain(SCROLL);
  });

  it('names the four stories first in the mural playbook and teaches the form in one line', () => {
    const [first = '', ...rest] = PIXI_MURAL_SKILL.instructions.split('\n');
    for (const id of STORY_IDS) expect(first).toContain(id);
    const story = rest.find((line) => line.startsWith('STORY murals:')) ?? '';
    expect(story).toContain('3-5 beats on one labelled anim.timeline');
    expect(story).toContain('anim.rig');
    expect(story).toContain('tl.progress(s.scroll.progress)');
    expect(PIXI_MURAL_SKILL.instructions).toMatch(/^NO UI: a mural is the art/mu);
  });

  it('teaches the mural story in the scroll playbook: vignettes, depth, rigs, beats, scrub, no UI', () => {
    const line =
      CREATIVE_SCROLL_MURAL_SKILL.instructions
        .split('\n')
        .find((candidate) => candidate.startsWith('MURAL STORY')) ?? '';
    expect(line).toContain(
      'ready presets desert-caravan, fishing-village, seed-to-forest, souq-morning',
    );
    for (const phrase of [
      'illustrated vignettes',
      'far/mid/near layers',
      'anim.rig',
      'anim.timeline({repeat:-1}) with labels per beat (3-5)',
      'timeline({paused:true}) and tl.progress(eased s.scroll.progress)',
      'NO UI: no buttons, captions or dialogue boxes',
      'tl.progress(strongest beat)',
    ]) {
      expect(line).toContain(phrase);
    }
    const activation = CREATIVE_SCROLL_MURAL_SKILL.activation;
    expect(activation !== undefined && 'keywords' in activation ? activation.keywords : []).toEqual(
      expect.arrayContaining(['mural story', 'illustrated mural', 'قصة جدارية', 'جدارية تحكي']),
    );
  });

  it('teaches the timeline controls a story needs in the anim playbook', () => {
    for (const phrase of [
      'anim.timeline({repeat,yoyo,paused})',
      ".label('b2')",
      'to|from|fromTo(target or [targets],props,{duration,ease,stagger},at)',
      "'<'|'>'|'+=0.2'|'b2+=0.5'",
      'tl.seek(t|label)',
      'tl.progress(p) scrubs (s.scroll.progress)',
    ]) {
      expect(CREATIVE_ANIMATION_SKILL.instructions).toContain(phrase);
    }
  });

  it('keeps each playbook inside its single-skill budget', () => {
    for (const id of [MURAL, SCROLL, CREATIVE_ANIMATION_SKILL.id]) {
      const result = REGISTRY.prepare({ request: '', auto: false, selectedSkillIds: [id] });
      expect(result.omitted).toEqual([]);
      expect(result.totalTokens).toBeLessThan(2_800);
    }
  });
});
