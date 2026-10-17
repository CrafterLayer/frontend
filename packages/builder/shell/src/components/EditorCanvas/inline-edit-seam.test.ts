import { describe, expect, it, vi } from 'vitest';

import { createMutableInlineEditSeam, type InlineEditBinding } from './inline-edit-seam';

const binding = (nodeId: string): InlineEditBinding => ({
  nodeId,
  target: { propKey: 'label', render: null },
});

describe('createMutableInlineEditSeam (node-keyed inline-edit store)', () => {
  it('answers a snapshot only for the bound node', () => {
    const seam = createMutableInlineEditSeam();
    const a = binding('a');
    seam.set(a);
    expect(seam.getSnapshot('a')).toBe(a.target);
    expect(seam.getSnapshot('b')).toBeNull();
    seam.set(null);
    expect(seam.getSnapshot('a')).toBeNull();
  });

  it('notifies ONLY the node losing and the node gaining the seam', () => {
    const seam = createMutableInlineEditSeam();
    const onA = vi.fn();
    const onB = vi.fn();
    const onC = vi.fn();
    seam.subscribe('a', onA);
    seam.subscribe('b', onB);
    seam.subscribe('c', onC);
    seam.set(binding('a'));
    expect([onA.mock.calls.length, onB.mock.calls.length, onC.mock.calls.length]).toEqual([
      1, 0, 0,
    ]);
    seam.set(binding('b'));
    expect([onA.mock.calls.length, onB.mock.calls.length, onC.mock.calls.length]).toEqual([
      2, 1, 0,
    ]);
  });

  it('a new binding for the SAME node notifies it once; the identical binding not at all', () => {
    const seam = createMutableInlineEditSeam();
    const onA = vi.fn();
    seam.subscribe('a', onA);
    const first = binding('a');
    seam.set(first);
    seam.set(first);
    expect(onA).toHaveBeenCalledTimes(1);
    seam.set(binding('a'));
    expect(onA).toHaveBeenCalledTimes(2);
  });

  it('an unsubscribed listener hears nothing more', () => {
    const seam = createMutableInlineEditSeam();
    const onA = vi.fn();
    const off = seam.subscribe('a', onA);
    off();
    seam.set(binding('a'));
    expect(onA).not.toHaveBeenCalled();
  });
});
