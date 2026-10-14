import { describe, expect, it } from 'vitest';

import { planCreativeBrief, renderCreativeBrief } from './creative-planner';

/*
  Mural stories (2026-10-14): the owner's murals are illustrated stories («قصص جدارية») — a wide
  painted panorama of people or animals, places and things told in beats — not abstract patterns.
  A mural request that names a story is briefed as that form; any other mural keeps its brief.
*/
describe('creative brief — mural stories', () => {
  it.each([
    'جدارية تحكي قصة قافلة في الصحراء',
    'اعمل قصة جدارية عن قرية صيادين',
    'بدي قصص جدارية عن السوق القديم',
    'A mural story of a fishing village',
    'An illustrated mural of a seed that grows into a forest',
    'A mural telling the story of a fox',
  ])(
    'briefs %s as a mural story: beats on an anim timeline, depth, scroll scrub, no UI',
    (request) => {
      const brief = planCreativeBrief(request);
      expect(brief).toMatchObject({ kind: 'scene', genre: 'mural' });
      expect(brief.libs).toContain('anim');
      expect(brief.libs).not.toContain('dialogue');
      const text = renderCreativeBrief(brief);
      expect(text).toContain('illustrated mural story, not abstract patterns');
      expect(text).toContain('far/mid/near depth layers');
      expect(text).toContain('one s.lib.anim timeline with a label per beat (3-5)');
      expect(text).toContain('tl.progress(s.scroll.progress)');
      expect(text).toContain('no UI of its own');
      expect(text).toContain('desert-caravan | fishing-village | seed-to-forest | souq-morning');
      expect(brief.beats.map(({ id }) => id)).toEqual(['establish', 'journey', 'turn', 'arrive']);
    },
  );

  it('writes the beats in the brief language', () => {
    const arabic = planCreativeBrief('جدارية تحكي قصة قافلة في الصحراء');
    expect(arabic.language).toBe('ar');
    expect(arabic.beats[0]?.purpose).toMatch(/[؀-ۿ]/u);
    expect(planCreativeBrief('A mural story of a desert caravan').beats[0]?.purpose).toBe(
      'the place and its cast at one time of day',
    );
  });

  it('adds Open Peeps people when the story names people or characters, never for animals alone', () => {
    expect(planCreativeBrief('A mural story about a family at the souq').libs).toContain('peeps');
    expect(planCreativeBrief('جدارية تحكي قصة «ليلى» في السوق').libs).toContain('peeps');
    expect(planCreativeBrief('A mural story of a fox and the birds').libs).not.toContain('peeps');
  });

  it('leaves other murals, scroll murals and stories as they were', () => {
    for (const request of [
      'An illustrated generative art mural',
      'A layered mural of a city at night',
      'A parallax scroll mural of a desert',
    ]) {
      const brief = planCreativeBrief(request);
      expect(brief.genre, request).toBe('mural');
      expect(renderCreativeBrief(brief), request).not.toContain('illustrated mural story');
      expect(
        brief.beats.map(({ id }) => id),
        request,
      ).toEqual(['focus', 'ambient', 'response']);
    }
    expect(planCreativeBrief('An illustrated generative art mural').libs).toEqual(['fx', 'anim']);
    const story = planCreativeBrief('اعمل قصة تفاعلية عن ليلى');
    expect(story.kind).toBe('story');
    expect(renderCreativeBrief(story)).not.toContain('illustrated mural story');
  });
});
