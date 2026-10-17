import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { setUtilityClassOracle } from '@craftkit/builder-schema';

import { partSource } from './part-source';
import { makePartTestKernel, partStyleAt, PROMO_ID } from './part-test-kernel';

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

const padding = (token: string) =>
  ({ property: 'padding', value: { kind: 'token', token }, bucket: 'base', state: 'default' }) as const;
const rawPadding = (css: string) =>
  ({ property: 'padding', value: { kind: 'raw', css }, bucket: 'base', state: 'default' }) as const;

describe('partSource', () => {
  it('is a tokens-mode source named after the block and the part', () => {
    const kernel = makePartTestKernel();
    const source = partSource(kernel, PROMO_ID, { part: 'heading', index: [] }, 'all');
    expect(source.mode).toBe('tokens');
    expect(source.targetCount).toBe(1);
    expect(source.label).toBe('Promo Heading');
    expect(source.read()).toEqual(['']);
  });

  it('writes partStyles[part] as ONE labelled transaction, undone in one step', () => {
    const kernel = makePartTestKernel();
    const source = partSource(kernel, PROMO_ID, { part: 'heading', index: [] }, 'all');
    expect(source.apply([padding('4')], 'Padding')).toEqual({ ok: true });
    expect(partStyleAt(kernel, 'heading')?.className).toBe('p-4');
    expect(source.read()).toEqual(['p-4']);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Padding · Promo Heading');
    kernel.undo();
    expect(partStyleAt(kernel, 'heading')).toBeUndefined();
    expect(source.read()).toEqual(['']);
  });

  it('the this-item scope writes name@i and leaves the all-items key alone', () => {
    const kernel = makePartTestKernel();
    const ref = { part: 'item.title', index: [1] };
    const one = partSource(kernel, PROMO_ID, ref, 'this');
    expect(one.apply([padding('2')], 'Padding')).toEqual({ ok: true });
    expect(partStyleAt(kernel, 'item.title@1')?.className).toBe('p-2');
    expect(partStyleAt(kernel, 'item.title')).toBeUndefined();

    const all = partSource(kernel, PROMO_ID, ref, 'all');
    expect(all.read()).toEqual(['']);
    expect(all.apply([padding('6')], 'Padding')).toEqual({ ok: true });
    expect(partStyleAt(kernel, 'item.title')?.className).toBe('p-6');
    expect(one.read()).toEqual(['p-2']);
    expect(one.id).not.toBe(all.id);
  });

  it('refuses a free value in tokens mode and leaves the document untouched', () => {
    const kernel = makePartTestKernel();
    const source = partSource(kernel, PROMO_ID, { part: 'heading', index: [] }, 'all');
    const result = source.apply([rawPadding('17px')], 'Padding');
    expect(result.ok).toBe(false);
    expect(kernel.transactions()).toHaveLength(0);
    expect(partStyleAt(kernel, 'heading')).toBeUndefined();
  });

  it('refuses an undeclared part and a removed block, naming what to send', () => {
    const kernel = makePartTestKernel();
    const unknown = partSource(kernel, PROMO_ID, { part: 'nope', index: [] }, 'all');
    const refused = unknown.apply([padding('4')], 'Padding');
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.message).toContain('·');
    expect(kernel.transactions()).toHaveLength(0);

    const gone = partSource(kernel, 'missing', { part: 'heading', index: [] }, 'all');
    expect(gone.read()).toEqual(['']);
    expect(gone.apply([padding('4')], 'Padding').ok).toBe(false);
  });

  it('subscribes to its node: a write to it notifies, undo included', () => {
    const kernel = makePartTestKernel();
    const source = partSource(kernel, PROMO_ID, { part: 'heading', index: [] }, 'all');
    const listener = vi.fn();
    const stop = source.subscribe(listener);
    source.apply([padding('4')], 'Padding');
    kernel.undo();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it('labels in Arabic when the editor is Arabic', () => {
    const kernel = makePartTestKernel({ dir: 'rtl' });
    const source = partSource(kernel, PROMO_ID, { part: 'heading', index: [] }, 'all', { locale: 'ar' });
    expect(source.label).toContain('العنوان');
  });
});
