import { describe, expect, it } from 'vitest';

import { creativeBriefFor, planCreativeBrief, renderCreativeBrief } from './creative-planner';
import { closeMuralPreset, composesWithKit } from './mural-kit';

/*
  mural kit (2026-10-14): an illustrated mural is briefed as a short s.lib.mural composition —
  'mural' joins the libs, and a subject no ready preset closely matches carries the kit's
  mechanics and its whole vocabulary; a close match is still offered; abstract murals keep their
  brief.
*/
describe('creative brief — the mural kit', () => {
  it.each([
    'A mural of an underwater coral reef with a diver and fish',
    'A mural of a space journey from Earth to the Moon',
    'جدارية لليلة رمضان في مدينة عربية قديمة مع الفوانيس والهلال',
    'A mural of a Japanese garden with a blossom tree and a koi pond',
    'جدارية لقرية جبلية في الشتاء والثلج',
    'A fairy-tale forest mural with a castle and fireflies',
    'A mural story of a farm day with animals',
  ])('composes "%s" with s.lib.mural and its vocabulary', (request) => {
    const brief = planCreativeBrief(request);
    expect(brief).toMatchObject({ kind: 'scene', genre: 'mural' });
    expect(brief.libs).toEqual(expect.arrayContaining(['mural', 'anim']));
    const text = renderCreativeBrief(brief);
    expect(text).toContain('compose with s.lib.mural, the default for any illustrated mural');
    expect(text).toContain(
      "ck.scene({libs:['mural','anim'],seed,design:{width:1280,height:720,fit:'cover'}})",
    );
    expect(text).toContain('a 1-3k-character spec');
    for (const word of [
      'underwater',
      'mosque(teal|gold)',
      'castle dragon fireflies sparkles',
      'beat: { label',
    ]) {
      expect(text).toContain(word);
    }
    expect(text).not.toContain('closely matches this subject');
  });

  it('never nudges a picture into an abstract preset that shares one word', () => {
    expect(closeMuralPreset('A mural of an underwater coral reef')).toBeUndefined();
    expect(closeMuralPreset('An aurora over a snowy village')).toBeUndefined();
    expect(renderCreativeBrief(planCreativeBrief('A mural of a coral reef'))).not.toContain(
      'differential-growth-coral',
    );
  });

  it.each([
    ['A mural story of a fishing village at dawn', 'fishing-village'],
    ['جدارية تحكي قصة قافلة في الصحراء', 'desert-caravan'],
    ['A mural of a seed that grows into a forest', 'seed-to-forest'],
    ['A paper cut landscape mural', 'paper-cut-landscape'],
    ['Use the souq-morning mural', 'souq-morning'],
  ])('offers the close preset for "%s"', (request, id) => {
    expect(closeMuralPreset(request)?.id).toBe(id);
    const brief = planCreativeBrief(request);
    expect(brief.libs).toContain('mural');
    const text = renderCreativeBrief(brief);
    expect(text).toContain(
      `the ready preset ${id} closely matches this subject: scene.preset ${id}`,
    );
    expect(text).not.toContain('mural kit vocabulary');
  });

  it('keeps abstract and generative murals on their own brief', () => {
    for (const request of [
      'An illustrated generative art mural',
      'A flow field mural with particles',
      'جدارية زخارف هندسية',
    ]) {
      const brief = planCreativeBrief(request);
      expect(brief.libs, request).not.toContain('mural');
      expect(renderCreativeBrief(brief), request).not.toContain('s.lib.mural');
    }
  });

  it('carries the page request into a section brief', () => {
    const brief = creativeBriefFor(
      'The harbour at night',
      'A mural of a harbour with a tall ship and a train',
    );
    expect(brief.libs).toContain('mural');
    expect(renderCreativeBrief(brief)).toContain('compose with s.lib.mural');
  });

  it('composes only pictures: a subjectless, abstract or preset-matched mural keeps the ready scenes', () => {
    expect(composesWithKit('A mural of a coral reef with a diver')).toBe(true);
    expect(composesWithKit('جدارية لليلة رمضان في مدينة قديمة')).toBe(true);
    expect(composesWithKit('A calm animated mural for the hero')).toBe(false);
    expect(composesWithKit('A generative flow field mural')).toBe(false);
    expect(composesWithKit('A mural story of a fishing village')).toBe(false);
    expect(planCreativeBrief('A calm animated mural for the hero').libs).not.toContain('mural');
  });
});
