import { describe, expect, it, vi } from 'vitest';

import { createAnchorChannel, type AnchorSnapshot } from './anchor-channel';
import type { FrameBridge } from './frame-bridge';
import type { RectIndex } from '../rects';

function harness() {
  const invalidateListeners = new Set<() => void>();
  const rects = new Map<string, { x: number; y: number; width: number; height: number }>([
    ['a', { x: 10, y: 20, width: 100, height: 40 }],
  ]);
  const index = {
    rect: (id: string) => {
      const found = rects.get(id);
      return found === undefined ? undefined : { nodeId: id, ...found, version: 1 };
    },
    onInvalidate: (listener: () => void) => {
      invalidateListeners.add(listener);
      return () => invalidateListeners.delete(listener);
    },
  } as unknown as RectIndex;

  const frame = { x: 200, y: 100, width: 800, height: 600 };
  const bridge = {
    frameBox: () => ({ ...frame }),
    hostViewport: () => ({ width: 1440, height: 900 }),
    visibleArea: () => ({ width: frame.width, height: frame.height }),
    scale: () => 1,
  } as unknown as FrameBridge;

  const queue: (() => void)[] = [];
  const snapshots: AnchorSnapshot[] = [];
  const channel = createAnchorChannel({
    index,
    bridge,
    schedule: (callback) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) {
          queue.splice(at, 1);
        }
      };
    },
    onSnapshot: (snapshot) => snapshots.push(snapshot),
  });

  const flush = () => {
    for (const callback of queue.splice(0)) {
      callback();
    }
  };
  const invalidate = () => {
    for (const listener of [...invalidateListeners]) {
      listener();
    }
  };
  return { channel, snapshots, flush, invalidate, rects, frame, queue, invalidateListeners };
}

describe('createAnchorChannel (009 §2/§7)', () => {
  it('publishes the block rect, the frame box, and the viewport together', () => {
    const h = harness();
    h.channel.setBlock('a');
    h.flush();

    expect(h.snapshots).toHaveLength(1);
    expect(h.snapshots[0]).toEqual({
      block: { x: 10, y: 20, width: 100, height: 40 },
      text: null,
      frame: { x: 200, y: 100, width: 800, height: 600 },
      viewport: { width: 1440, height: 900 },
      visible: { width: 800, height: 600 },
      scale: 1,
    });
  });

  it('BATCHES to one flush per frame — a burst of invalidations is one snapshot', () => {
    const h = harness();
    h.channel.setBlock('a');
    h.invalidate();
    h.invalidate();
    h.invalidate();
    expect(h.queue).toHaveLength(1); // coalesced, never one callback per event
    h.flush();
    expect(h.snapshots).toHaveLength(1);
  });

  it('recomputes on the observer channel — no polling anywhere', () => {
    const h = harness();
    h.channel.setBlock('a');
    h.flush();

    h.rects.set('a', { x: 10, y: 300, width: 100, height: 40 });
    h.invalidate();
    h.flush();
    expect(h.snapshots.at(-1)?.block).toEqual({ x: 10, y: 300, width: 100, height: 40 });
  });

  it('reports a null block when the node has no rect (removed or never attached)', () => {
    const h = harness();
    h.channel.setBlock('ghost');
    h.flush();
    expect(h.snapshots.at(-1)?.block).toBeNull();
  });

  it('carries the text anchor through, including multi-line rects', () => {
    const h = harness();
    const anchor = {
      box: { x: 0, y: 0, width: 200, height: 40 },
      rects: [
        { x: 100, y: 0, width: 100, height: 20 },
        { x: 0, y: 20, width: 80, height: 20 },
      ],
    };
    h.channel.setText(() => anchor);
    h.flush();
    expect(h.snapshots.at(-1)?.text).toEqual(anchor);

    h.channel.setText(null);
    h.flush();
    expect(h.snapshots.at(-1)?.text).toBeNull();
  });

  it('RE-MEASURES the text selection on every flush instead of replaying frozen geometry', () => {
    const h = harness();
    let anchor = {
      box: { x: 10, y: 40, width: 60, height: 18 },
    };
    let measurements = 0;
    h.channel.setText(() => {
      measurements += 1;
      return anchor;
    });
    h.flush();
    expect(h.snapshots.at(-1)?.text).toEqual(anchor);

    anchor = { box: { x: 10, y: 240, width: 90, height: 18 } };
    h.invalidate();
    h.flush();
    expect(h.snapshots.at(-1)?.text).toEqual(anchor);

    anchor = { box: { x: 10, y: 700, width: 90, height: 18 } };
    h.channel.refresh();
    h.flush();
    expect(h.snapshots.at(-1)?.text).toEqual(anchor);
    expect(measurements).toBe(3);
  });

  it('measures only the latest source after rapid selection reports coalesce', () => {
    const h = harness();
    let measurements = 0;
    for (const x of [10, 20, 30, 40, 50]) {
      h.channel.setText(() => {
        measurements += 1;
        return { box: { x, y: 40, width: 60, height: 18 } };
      });
    }

    expect(measurements).toBe(0);
    expect(h.queue).toHaveLength(1);
    h.flush();
    expect(measurements).toBe(1);
    expect(h.snapshots.at(-1)?.text?.box.x).toBe(50);
  });

  it('setting the SAME block again does not schedule redundant work', () => {
    const h = harness();
    h.channel.setBlock('a');
    h.flush();
    h.channel.setBlock('a');
    expect(h.queue).toHaveLength(0);
  });

  it('refresh() covers what the index cannot see (a host scroll or resize)', () => {
    const h = harness();
    h.channel.setBlock('a');
    h.flush();
    h.frame.y = 400;
    h.channel.refresh();
    h.flush();
    expect(h.snapshots.at(-1)?.frame.y).toBe(400);
  });

  it('dispose detaches the observer and cancels pending work', () => {
    const h = harness();
    h.channel.setBlock('a');
    h.channel.dispose();
    expect(h.invalidateListeners.size).toBe(0);

    const before = h.snapshots.length;
    h.flush();
    h.invalidate();
    expect(h.snapshots).toHaveLength(before);
  });

  it('never calls onSnapshot synchronously — positioning stays on the frame rhythm', () => {
    const onSnapshot = vi.fn();
    const h = harness();
    void onSnapshot;
    h.channel.setBlock('a');
    expect(h.snapshots).toHaveLength(0); // only after the scheduled flush
    h.flush();
    expect(h.snapshots).toHaveLength(1);
  });
});
