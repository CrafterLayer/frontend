import { describe, expect, it } from 'vitest';

import { partTarget } from '../../overlay/part-target';
import { promoKernel, promoProps } from '../../overlay/part-test-kit';
import { PART_QUICK_BAR_LABELS_AR } from './ElementQuickBar.labels';
import { PART_ACTION_WORDS_EN, performPartAction, resolvePartActions } from './part-actions';

const CONTEXT = { scope: 'all', locale: 'en', words: PART_ACTION_WORDS_EN } as const;
const titles = (kernel: ReturnType<typeof promoKernel>) => promoProps(kernel).items.map((item) => item.title);
const focus = (kernel: ReturnType<typeof promoKernel>) => kernel.context.store.getState().partFocus;

describe('part actions (block-parts DESIGN §2.14)', () => {
  it('offers what the part is: text edits and direction, a link editor, item actions with their gates', () => {
    const kernel = promoKernel();
    const ids = (part: string, index: number[]) =>
      resolvePartActions(kernel, partTarget('promo', { part, index }), CONTEXT).map((action) => action.id);
    expect(ids('heading', [])).toEqual(['editText', 'dirAuto', 'dirLtr', 'dirRtl', 'selectBlock']);
    expect(ids('cta', [])).toEqual(['editText', 'link', 'dirAuto', 'dirLtr', 'dirRtl', 'selectBlock']);
    expect(ids('image', [])).toEqual(['selectBlock']);
    expect(ids('item', [0])).toEqual(['addAfter', 'duplicate', 'moveUp', 'moveDown', 'remove', 'scopeThis', 'selectBlock']);
    // A title inside a card carries the card's actions too.
    expect(ids('item.title', [1])).toEqual(expect.arrayContaining(['editText', 'remove', 'scopeThis']));

    const first = resolvePartActions(kernel, partTarget('promo', { part: 'item', index: [0] }), CONTEXT);
    expect(first.find((action) => action.id === 'moveUp')).toMatchObject({ enabled: false, reason: 'Already the first item' });
    const last = resolvePartActions(kernel, partTarget('promo', { part: 'item', index: [2] }), CONTEXT);
    expect(last.find((action) => action.id === 'moveDown')?.enabled).toBe(false);
    const readOnly = resolvePartActions(kernel, partTarget('promo', { part: 'item', index: [1] }), { ...CONTEXT, editable: false });
    expect(readOnly.find((action) => action.id === 'remove')?.enabled).toBe(false);
  });

  it('remove is ONE transaction, and the focus moves to the neighbour', () => {
    const kernel = promoKernel();
    const target = partTarget('promo', { part: 'item', index: [1] });
    kernel.focusPart('promo', target);
    const before = kernel.transactions().length;
    const result = performPartAction(kernel, target, 'remove', CONTEXT);
    expect(result).toEqual({ ok: true, announcement: 'Remove item · Feature 2' });
    expect(kernel.transactions().length).toBe(before + 1);
    expect(titles(kernel)).toEqual(['Fast', 'Simple']);
    expect(focus(kernel)).toEqual({ id: 'promo', part: 'item', index: [1] });
    kernel.undo();
    expect(titles(kernel)).toEqual(['Fast', 'Safe', 'Simple']);
  });

  it('move, duplicate and add after act on the card a title lives in, and the focus follows it', () => {
    const kernel = promoKernel();
    const title = partTarget('promo', { part: 'item.title', index: [0] });
    performPartAction(kernel, title, 'moveDown', CONTEXT);
    expect(titles(kernel)).toEqual(['Safe', 'Fast', 'Simple']);
    expect(focus(kernel)).toEqual({ id: 'promo', part: 'item.title', index: [1] });

    performPartAction(kernel, partTarget('promo', { part: 'item', index: [1] }), 'duplicate', CONTEXT);
    expect(titles(kernel)).toEqual(['Safe', 'Fast', 'Fast', 'Simple']);
    expect(focus(kernel)).toEqual({ id: 'promo', part: 'item', index: [2] });

    performPartAction(kernel, partTarget('promo', { part: 'item', index: [3] }), 'addAfter', CONTEXT);
    expect(titles(kernel)).toHaveLength(5);

    const refused = performPartAction(kernel, partTarget('promo', { part: 'item', index: [0] }), 'moveUp', CONTEXT);
    expect(refused).toEqual({ ok: false, announcement: 'Already the first item' });
  });

  it('direction writes the instance override in partStyles; auto clears it', () => {
    const kernel = promoKernel('rtl');
    const heading = partTarget('promo', { part: 'heading', index: [] });
    performPartAction(kernel, heading, 'dirLtr', CONTEXT);
    expect(promoProps(kernel).partStyles).toEqual({ heading: { dir: 'ltr' } });
    const pressed = resolvePartActions(kernel, heading, CONTEXT).find((action) => action.pressed === true);
    expect(pressed?.id).toBe('dirLtr');
    performPartAction(kernel, heading, 'dirAuto', CONTEXT);
    expect(promoProps(kernel).partStyles).toEqual({});
  });

  it('announces in Arabic with the Arabic words', () => {
    const kernel = promoKernel('rtl');
    const result = performPartAction(kernel, partTarget('promo', { part: 'item', index: [2] }), 'remove', {
      scope: 'all',
      locale: 'ar',
      words: PART_QUICK_BAR_LABELS_AR,
    });
    expect(result.announcement).toBe('إزالة العنصر · ميزة 3');
    // The last card removed: the focus steps back to the card before it.
    expect(focus(kernel)).toEqual({ id: 'promo', part: 'item', index: [1] });
    expect(kernel.context.store.getState().selection).toEqual(['promo']);
  });

  it('select block clears the part focus and keeps the block', () => {
    const kernel = promoKernel();
    kernel.focusPart('promo', { part: 'heading', index: [] });
    performPartAction(kernel, partTarget('promo', { part: 'heading', index: [] }), 'selectBlock', CONTEXT);
    expect(focus(kernel)).toBeNull();
    expect(kernel.context.store.getState().selection).toEqual(['promo']);
  });
});

// ── block-parts (2026-10-06) ──
describe('the scope switch shows how far a style reaches (fix pass)', () => {
  it('reads 1/3 for this item and 3/3 for all items', () => {
    const kernel = promoKernel();
    const scope = (value: 'all' | 'this') =>
      resolvePartActions(kernel, partTarget('promo', { part: 'item', index: [1] }), { ...CONTEXT, scope: value }).find(
        (action) => action.id === 'scopeThis',
      );
    expect(scope('this')).toMatchObject({ pressed: true, hint: '1/3' });
    expect(scope('all')).toMatchObject({ pressed: false, hint: '3/3' });
  });
});
// ── /block-parts ──
