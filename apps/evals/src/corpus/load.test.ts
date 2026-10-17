import { describe, expect, it } from 'vitest';

import { findEvalCase, loadCorpus, parseEvalCase } from './load';

const corpus = loadCorpus();

describe('the golden corpus', () => {
  it('holds at least twenty real requests', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(20);
  });

  it('gives every case a unique id', () => {
    expect(new Set(corpus.map((item) => item.id)).size).toBe(corpus.length);
  });

  it.each([
    ['a landing page', (id: string) => id === '01-landing-saas'],
    ['a pricing page', (id: string) => id === '02-pricing-page'],
    ['a portfolio', (id: string) => id === '03-portfolio-studio'],
    ['an edit to an existing page', (id: string) => id === '05-edit-hero-heading'],
    ['a request naming a specific block', (id: string) => id === '06-named-block-faq'],
    ['a very short request', (id: string) => id === '11-very-short-request'],
    ['a very long detailed request', (id: string) => id === '13-very-long-brief'],
  ])('covers %s', (_label, matches) => {
    expect(corpus.some((item) => matches(item.id))).toBe(true);
  });

  it('covers Arabic in a right-to-left document', () => {
    const rtl = corpus.filter((item) => item.dir === 'rtl');
    expect(rtl.length).toBeGreaterThanOrEqual(2);
    // Arabic letters, so a case cannot satisfy this by setting dir alone.
    expect(rtl.every((item) => /[؀-ۿ]/u.test(item.request))).toBe(true);
  });

  it('covers requests that must be refused', () => {
    const refusals = corpus.filter((item) => item.must.outcome === 'refusal');
    expect(refusals.length).toBeGreaterThanOrEqual(3);
    expect(refusals.some((item) => item.request.trim() === '')).toBe(true);
  });

  it('covers prompt injection, with a payload the grader can look for', () => {
    const injections = corpus.filter((item) => item.category === 'injection');
    expect(injections.length).toBeGreaterThanOrEqual(2);
    expect(injections.every((item) => item.must.forbiddenText.length > 0)).toBe(true);
  });

  it('states, for every case, why it exists', () => {
    expect(corpus.every((item) => item.why.length > 40)).toBe(true);
  });

  it('gives every edit case a node id the plan has to address', () => {
    const edits = corpus.filter((item) => item.category === 'edit');
    expect(edits.length).toBeGreaterThanOrEqual(2);
    expect(edits.some((item) => item.must.requiredTargetNodeIds.length > 0)).toBe(true);
  });

  it('finds a case by id and refuses an unknown one', () => {
    expect(findEvalCase('01-landing-saas', corpus).category).toBe('landing');
    expect(() => findEvalCase('nope', corpus)).toThrow(/Unknown eval case/u);
  });
});

describe('parseEvalCase', () => {
  const valid = {
    id: 'x',
    title: 'x',
    category: 'x',
    fixture: 'empty',
    dir: 'ltr',
    request: 'x',
    must: { outcome: 'plan', forbiddenCommands: [], forbiddenText: [], requiredTargetNodeIds: [] },
    should: {},
    budget: { maxCommands: 1, maxContextTokens: 1, maxElapsedMs: 1 },
    rubric: 'x',
    why: 'x',
  };

  it('accepts a well-formed case', () => {
    expect(parseEvalCase(valid, 'x.json').id).toBe('x');
  });

  it('keeps a blank request, because one case is deliberately blank', () => {
    expect(parseEvalCase({ ...valid, request: '   ' }, 'x.json').request).toBe('   ');
  });

  it.each([
    ['an unknown fixture', { ...valid, fixture: 'imaginary' }],
    ['an unknown direction', { ...valid, dir: 'sideways' }],
    ['an unknown outcome', { ...valid, must: { ...valid.must, outcome: 'maybe' } }],
    ['a missing budget', { ...valid, budget: undefined }],
    [
      'a non-string forbidden command',
      { ...valid, must: { ...valid.must, forbiddenCommands: [7] } },
    ],
    ['a non-object payload', 'not a case'],
  ])('rejects %s', (_label, candidate) => {
    expect(() => parseEvalCase(candidate, 'x.json')).toThrow(/Eval case x\.json/u);
  });
});
