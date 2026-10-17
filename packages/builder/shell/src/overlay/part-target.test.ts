import { describe, expect, it } from 'vitest';

import {
  enclosingItemRef,
  firstPart,
  firstPartInside,
  isLivePart,
  parsePartIndex,
  partChipLabel,
  partInstanceKey,
  partInstanceName,
  partInstancesOf,
  partsOfNode,
  partTarget,
  partTargetFromFocus,
  samePartRef,
  steppedPart,
} from './part-target';
import { promoKernel } from './part-test-kit';

describe('part targets (block-parts DESIGN §2.6)', () => {
  it('a target is the node plus the part reference, copied', () => {
    const index = [2];
    const target = partTarget('promo', { part: 'item.title', index });
    expect(target).toEqual({ kind: 'part', nodeId: 'promo', part: 'item.title', index: [2] });
    expect(target.index).not.toBe(index);
    expect(partInstanceKey(target)).toBe('item.title@2');
    expect(partInstanceKey({ part: 'heading', index: [] })).toBe('heading');
  });

  it('compares references by name and every index', () => {
    expect(samePartRef({ part: 'item', index: [1] }, { part: 'item', index: [1] })).toBe(true);
    expect(samePartRef({ part: 'item', index: [1] }, { part: 'item', index: [2] })).toBe(false);
    expect(samePartRef({ part: 'item', index: [1] }, { part: 'items', index: [1] })).toBe(false);
    expect(samePartRef(null, undefined)).toBe(false);
  });

  it('parses a stamped index and refuses anything that is not digits and dots', () => {
    expect(parsePartIndex(null)).toEqual([]);
    expect(parsePartIndex('')).toEqual([]);
    expect(parsePartIndex('2')).toEqual([2]);
    expect(parsePartIndex('1.3')).toEqual([1, 3]);
    expect(parsePartIndex('1;drop')).toBeUndefined();
    expect(parsePartIndex('-1')).toBeUndefined();
  });

  it('reads the focus only while it belongs to the selected node', () => {
    expect(
      partTargetFromFocus({ selection: ['promo'], partFocus: { id: 'promo', part: 'heading', index: [] } }),
    ).toEqual({ kind: 'part', nodeId: 'promo', part: 'heading', index: [] });
    expect(
      partTargetFromFocus({ selection: ['chip'], partFocus: { id: 'promo', part: 'heading', index: [] } }),
    ).toBeUndefined();
    expect(partTargetFromFocus({ selection: ['promo'], partFocus: null })).toBeUndefined();
    expect(partTargetFromFocus({ selection: ['promo'] })).toBeUndefined();
  });

  it('lists the live instances in declaration then document order', () => {
    const kernel = promoKernel();
    const names = partInstancesOf(kernel, 'promo').map((instance) => partInstanceKey(instance));
    expect(names).toEqual([
      'heading',
      'cta',
      'image',
      'items',
      'item@0',
      'item@1',
      'item@2',
      'item.title@0',
      'item.title@1',
      'item.title@2',
    ]);
    expect(Object.keys(partsOfNode(kernel, 'ghost'))).toEqual([]);
    expect(isLivePart(kernel, 'promo', { part: 'item', index: [2] })).toBe(true);
    expect(isLivePart(kernel, 'promo', { part: 'item', index: [3] })).toBe(false);
  });

  it('Tab order steps through the instances and stops at either end', () => {
    const kernel = promoKernel();
    expect(firstPart(kernel, 'promo')).toEqual({ part: 'heading', index: [] });
    expect(steppedPart(kernel, 'promo', { part: 'heading', index: [] }, 1)).toEqual({ part: 'cta', index: [] });
    expect(steppedPart(kernel, 'promo', { part: 'heading', index: [] }, -1)).toBeUndefined();
    expect(steppedPart(kernel, 'promo', { part: 'item.title', index: [2] }, 1)).toBeUndefined();
    expect(steppedPart(kernel, 'promo', { part: 'item', index: [0] }, 1)).toEqual({ part: 'item', index: [1] });
  });

  it('finds the item a part lives in, and the first part inside a list or an item', () => {
    const kernel = promoKernel();
    const parts = partsOfNode(kernel, 'promo');
    expect(enclosingItemRef(parts, { part: 'item.title', index: [2] })).toEqual({ part: 'item', index: [2] });
    expect(enclosingItemRef(parts, { part: 'item', index: [1] })).toEqual({ part: 'item', index: [1] });
    expect(enclosingItemRef(parts, { part: 'heading', index: [] })).toBeUndefined();
    expect(firstPartInside(kernel, 'promo', { part: 'items', index: [] })).toEqual({ part: 'item', index: [0] });
    expect(firstPartInside(kernel, 'promo', { part: 'item', index: [1] })).toEqual({
      part: 'item.title',
      index: [1],
    });
    expect(firstPartInside(kernel, 'promo', { part: 'heading', index: [] })).toBeUndefined();
  });

  it('names an instance in the editor language, counting from one, beside its block', () => {
    const kernel = promoKernel();
    expect(partInstanceName(kernel, 'promo', { part: 'heading', index: [] }, 'en')).toBe('Heading');
    expect(partInstanceName(kernel, 'promo', { part: 'item.title', index: [1] }, 'ar')).toBe('عنوان الميزة 2');
    expect(partChipLabel(kernel, 'promo', { part: 'cta', index: [] }, 'en')).toBe('Button · Promo');
    expect(partChipLabel(kernel, 'promo', { part: 'cta', index: [] }, 'ar')).toMatch(/^الزر · /u);
  });
});
