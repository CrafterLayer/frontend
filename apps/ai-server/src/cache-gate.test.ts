/**
 * The cache gate (2026-10-12): parallel requests that share a prefix go one first, the rest
 * once it streams. Ours to prove: a different shape never waits; a same-shape request waits
 * for the writer to stream, then goes; a streamed shape is warm and waits for no one; a
 * writer that fails lets its siblings go without warming; every wait is bounded and ends on
 * cancel; a writer that never released is taken over; a throw before streaming releases.
 */
import { describe, expect, it } from 'vitest';

import { cacheShape, createCacheGate, opened } from './cache-gate';

function settled(promise: Promise<unknown>): () => boolean {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  return () => done;
}

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('createCacheGate', () => {
  it('holds a same-shape request until the writer streams, never another shape', async () => {
    const gate = createCacheGate();
    const release = await gate.enter('a');
    const sibling = settled(gate.enter('a'));
    const stranger = settled(gate.enter('b'));
    await tick();
    expect(sibling()).toBe(false);
    expect(stranger()).toBe(true);
    release(true);
    await tick();
    expect(sibling()).toBe(true);
    // Warm now: the next request of the shape waits for nobody.
    const again = settled(gate.enter('a'));
    await tick();
    expect(again()).toBe(true);
  });

  it('keeps a streamed shape warm, and a failed writer leaves it cold', async () => {
    let now = 0;
    const gate = createCacheGate({ now: () => now, warmMs: 1_000 });
    (await gate.enter('a'))(true);
    const warm = settled(gate.enter('a'));
    await tick();
    expect(warm()).toBe(true);

    (await gate.enter('b'))(false);
    const writer = await gate.enter('b');
    const waiting = settled(gate.enter('b'));
    await tick();
    expect(waiting()).toBe(false);
    writer(false);
    await tick();
    expect(waiting()).toBe(true);

    now = 2_000;
    const expired = await gate.enter('a');
    const behind = settled(gate.enter('a'));
    await tick();
    expect(behind()).toBe(false);
    expired(true);
  });

  it('bounds every wait, and ends it on cancel', async () => {
    const gate = createCacheGate({ maxWaitMs: 20 });
    await gate.enter('a');
    const bounded = settled(gate.enter('a'));
    await tick(40);
    expect(bounded()).toBe(true);

    const other = createCacheGate();
    await other.enter('b');
    const controller = new AbortController();
    const cancelled = settled(other.enter('b', controller.signal));
    await tick();
    expect(cancelled()).toBe(false);
    controller.abort();
    await tick();
    expect(cancelled()).toBe(true);
  });

  it('lets the next request take over from a writer that never released', async () => {
    let now = 0;
    const gate = createCacheGate({ now: () => now, maxWaitMs: 100 });
    await gate.enter('a');
    now = 500;
    const next = settled(gate.enter('a'));
    await tick();
    expect(next()).toBe(true);
  });

  it('releases when opening the stream throws', async () => {
    const gate = createCacheGate();
    const release = await gate.enter('a');
    expect(() =>
      opened(release, () => {
        throw new Error('bad request');
      }),
    ).toThrow('bad request');
    const next = settled(gate.enter('a'));
    await tick();
    expect(next()).toBe(true);
  });
});

describe('cacheShape', () => {
  it('is the same for the same parts and differs for any change', () => {
    expect(cacheShape(['m', 'low'])).toBe(cacheShape(['m', 'low']));
    expect(cacheShape(['m', 'low'])).not.toBe(cacheShape(['m', 'high']));
  });
});
