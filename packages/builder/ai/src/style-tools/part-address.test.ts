import { describe, expect, it } from 'vitest';

import { blockDisplayName, matchPartNames, partBlocks, partWordKey, resolvePartAddress } from './part-address';
import { partsKernel } from './part-tools.fixtures';

function refOf(result: ReturnType<typeof resolvePartAddress>) {
  if (!result.ok) throw new Error(result.error);
  return result.value.ref;
}

function errorOf(result: ReturnType<typeof resolvePartAddress>): string {
  if (result.ok) throw new Error(`expected a refusal, got ${result.value.ref.part}`);
  return result.error;
}

describe('resolvePartAddress — naming a part of a registered block', () => {
  it('takes the declared name', () => {
    expect(refOf(resolvePartAddress(partsKernel(), { id: 'hero-1', part: 'heading' }))).toEqual({ part: 'heading', index: [] });
    expect(refOf(resolvePartAddress(partsKernel(), { id: 'hero-1', part: 'trustLine' }))).toEqual({ part: 'trustLine', index: [] });
  });

  it('takes an alias, in any locale and case', () => {
    const kernel = partsKernel();
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'Title' })).part).toBe('heading');
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'badge' })).part).toBe('eyebrow');
    expect(refOf(resolvePartAddress(kernel, { id: 'cta-1', part: 'زر' })).part).toBe('button');
  });

  it('takes the Arabic label after folding (article, taa marbuta, hamza)', () => {
    const kernel = partsKernel('ar');
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'العنوان' })).part).toBe('heading');
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'الشاره' })).part).toBe('eyebrow');
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'للوصف' })).part).toBe('body');
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'السطر التعريفي' })).part).toBe('trustLine');
  });

  it('takes the English label, including a two-word one, with an index for a repeated part', () => {
    expect(refOf(resolvePartAddress(partsKernel(), { id: 'features-1', part: 'card title', index: [1] }))).toEqual({
      part: 'item.title',
      index: [1],
    });
  });

  it('finds a part by its exact visible text (text, link label, rich text)', () => {
    const kernel = partsKernel();
    expect(refOf(resolvePartAddress(kernel, { id: 'features-1', find: 'Safe' }))).toEqual({ part: 'item.title', index: [1] });
    expect(refOf(resolvePartAddress(kernel, { id: 'features-1', find: 'See all  features' }))).toEqual({ part: 'link', index: [] });
    expect(refOf(resolvePartAddress(kernel, { id: 'text-1', find: 'Every edit becomes one undo.' }))).toEqual({ part: 'content', index: [] });
  });

  it('refuses a find that matches more than one instance, listing them as part@index "text"', () => {
    const error = errorOf(resolvePartAddress(partsKernel(), { id: 'features-1', find: 'Fast' }));
    expect(error).toContain('item.title@0 "Fast"');
    expect(error).toContain('item.title@2 "Fast"');
    expect(error).toMatch(/ · send "part" and "index"/u);
  });

  it('refuses a repeated part with no index, listing the candidates', () => {
    const error = errorOf(resolvePartAddress(partsKernel(), { id: 'features-1', part: 'item.title' }));
    expect(error).toContain('item.title@0 "Fast"');
    expect(error).toContain('item.title@1 "Safe"');
    expect(error).toContain('· send "index"');
  });

  it('narrows a find by part and index', () => {
    expect(refOf(resolvePartAddress(partsKernel(), { id: 'features-1', part: 'item.title', find: 'Fast', index: [2] }))).toEqual({
      part: 'item.title',
      index: [2],
    });
  });

  it('says what is wrong and what to send', () => {
    const kernel = partsKernel();
    expect(errorOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'price' }))).toMatch(/has no part "price" · send one of: eyebrow, heading, body, trustLine/u);
    expect(errorOf(resolvePartAddress(kernel, { id: 'nope', part: 'heading' }))).toMatch(/is not a block on this page · send the id of one of: hero-1 \(hero\)/u);
    expect(errorOf(resolvePartAddress(kernel, { id: 'r-story', part: 'heading' }))).toMatch(/composed region.* · use element\.style/u);
    expect(errorOf(resolvePartAddress(kernel, { id: 'hero-1', part: 'heading', index: [0] }))).toMatch(/not repeated.* · drop "index"/u);
    expect(errorOf(resolvePartAddress(kernel, { id: 'features-1', part: 'item.title', index: [7] }))).toMatch(/no instance at index 7 .* · send one of:/u);
  });

  it('reads the props as the plan leaves them', () => {
    const kernel = partsKernel();
    const readProp = (id: string, key: string): unknown =>
      id === 'hero-1' && key === 'heading' ? 'Welcome' : kernel.getDocument().nodes[id]?.props[key];
    expect(refOf(resolvePartAddress(kernel, { id: 'hero-1', find: 'Welcome' }, readProp)).part).toBe('heading');
  });
});

describe('part words and blocks', () => {
  it('folds a word the way a person types it', () => {
    expect(partWordKey('للعنوان')).toBe('عنوان');
    expect(partWordKey('trustLine')).toBe('trust line');
    expect(partWordKey('the Card Title')).toBe('card title');
  });

  it('matches declared names, aliases and labels', () => {
    const [hero] = partBlocks(partsKernel());
    expect(hero?.id).toBe('hero-1');
    expect(matchPartNames(hero?.parts ?? {}, 'headline')).toEqual(['heading']);
    expect(matchPartNames(hero?.parts ?? {}, 'nothing')).toEqual([]);
  });

  it('lists the page blocks that declare parts, in page order', () => {
    expect(partBlocks(partsKernel()).map(({ id }) => id)).toEqual(['hero-1', 'cta-1', 'cta-2', 'features-1', 'text-1']);
  });

  it('names a block for history labels', () => {
    expect(blockDisplayName('hero')).toBe('Hero');
    expect(blockDisplayName('logoCloud')).toBe('Logo cloud');
    expect(blockDisplayName('bento-grid')).toBe('Bento grid');
  });
});
