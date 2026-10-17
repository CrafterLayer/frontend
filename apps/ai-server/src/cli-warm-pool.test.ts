import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CLI_WARM_IDLE_TTL_MS,
  CLI_WARM_MAX_PER_SHAPE,
  CLI_WARM_MAX_SPARES,
  createCliWarmPool,
  type WarmCliProcess,
} from './cli-warm-pool';

/**
 * The warm spares (DESIGN §7), without a `claude` on the PATH: what the pool
 * holds, for how long, and that nothing it hands out — or leaves behind — is
 * a dead process or an orphaned system prompt file.
 */

class FakeChild extends EventEmitter {
  readonly pid = undefined;
  exitCode: number | null = null;
  readonly kill = vi.fn();
}

interface Spawned {
  readonly child: FakeChild;
  readonly remove: ReturnType<typeof vi.fn>;
  readonly spare: WarmCliProcess;
}

function spawner(now: () => number = Date.now) {
  const spawned: Spawned[] = [];
  const spawn = vi.fn((): WarmCliProcess => {
    const child = new FakeChild();
    const remove = vi.fn();
    const spare: WarmCliProcess = {
      child: child,
      systemFile: { path: `/tmp/spare-${String(spawned.length)}.md`, remove },
      spawnedAt: now(),
    };
    spawned.push({ child, remove, spare });
    return spare;
  });
  return { spawn, spawned };
}

describe('cli warm pool', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the documented limits: a writer pool of spares (eight), a minute each', () => {
    expect(CLI_WARM_MAX_SPARES).toBe(8);
    expect(CLI_WARM_MAX_PER_SHAPE).toBe(8);
    expect(CLI_WARM_IDLE_TTL_MS).toBe(60_000);
  });

  it('keeps as many spares of a shape as it is asked for, and hands out the oldest first', () => {
    let clock = 1_000;
    const pool = createCliWarmPool({ now: () => clock });
    const { spawn, spawned } = spawner(() => clock);

    pool.prime('a', spawn, 1);
    clock += 500;
    pool.prime('a', spawn, 3);
    expect(spawn).toHaveBeenCalledTimes(3);
    // Asking for fewer than it holds spawns nothing and kills nothing.
    pool.prime('a', spawn, 1);
    expect(spawn).toHaveBeenCalledTimes(3);

    expect(pool.take('a')).toBe(spawned[0]?.spare);
    expect(pool.take('a')).toBe(spawned[1]?.spare);
    expect(pool.take('a')).toBe(spawned[2]?.spare);
    expect(pool.take('a')).toBeUndefined();
    pool.dispose();
  });

  it('holds no more of one shape than maxPerShape, and no more in all than maxSpares', () => {
    const pool = createCliWarmPool({ maxSpares: 5, maxPerShape: 3 });
    const { spawn } = spawner();

    pool.prime('a', spawn, 10);
    expect(spawn).toHaveBeenCalledTimes(3);
    pool.prime('b', spawn, 10);
    expect(spawn).toHaveBeenCalledTimes(5);
    pool.dispose();
  });

  it('has nothing to give before it is primed', () => {
    const pool = createCliWarmPool();
    expect(pool.take('a')).toBeUndefined();
    pool.dispose();
  });

  it('hands out the spare it primed, once, and then has none for that key', () => {
    const pool = createCliWarmPool();
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);

    expect(pool.take('a')).toBe(spawned[0]?.spare);
    expect(pool.take('a')).toBeUndefined();
    // Taken means owned by the caller: never killed, its file never removed by the pool.
    pool.dispose();
    expect(spawned[0]?.child.kill).not.toHaveBeenCalled();
    expect(spawned[0]?.remove).not.toHaveBeenCalled();
  });

  it('keeps one spare per key: priming a key that has one spawns nothing', () => {
    const pool = createCliWarmPool();
    const { spawn } = spawner();

    pool.prime('a', spawn);
    pool.prime('a', spawn);

    expect(spawn).toHaveBeenCalledTimes(1);
    pool.dispose();
  });

  it('never holds more than its cap', () => {
    const pool = createCliWarmPool({ maxSpares: 3 });
    const { spawn } = spawner();

    for (const key of ['a', 'b', 'c', 'd']) pool.prime(key, spawn);

    expect(spawn).toHaveBeenCalledTimes(3);
    expect(pool.take('d')).toBeUndefined();
    // A taken spare frees its place.
    expect(pool.take('a')).toBeDefined();
    pool.prime('d', spawn);
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(pool.take('d')).toBeDefined();
    pool.dispose();
  });

  it('kills a spare nobody took within the TTL and removes its system file', async () => {
    vi.useFakeTimers();
    const pool = createCliWarmPool({ idleTtlMs: 60_000 });
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(spawned[0]?.child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawned[0]?.child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(spawned[0]?.remove).toHaveBeenCalledTimes(1);
    expect(pool.take('a')).toBeUndefined();
    pool.dispose();
  });

  it('never hands out a spare past its TTL, even before the timer fired', () => {
    let clock = 1_000;
    const pool = createCliWarmPool({ idleTtlMs: 60_000, now: () => clock });
    const { spawn, spawned } = spawner(() => clock);

    pool.prime('a', spawn);
    clock += 60_000;

    expect(pool.take('a')).toBeUndefined();
    expect(spawned[0]?.child.kill).toHaveBeenCalled();
    expect(spawned[0]?.remove).toHaveBeenCalled();
    pool.dispose();
  });

  it('discards a spare that exited on its own, and primes a fresh one in its place', () => {
    const pool = createCliWarmPool();
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);
    spawned[0]?.child.emit('close', 1, null);

    expect(spawned[0]?.remove).toHaveBeenCalledTimes(1);
    // Already gone: nothing to kill.
    expect(spawned[0]?.child.kill).not.toHaveBeenCalled();
    expect(pool.take('a')).toBeUndefined();

    pool.prime('a', spawn);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(pool.take('a')).toBe(spawned[1]?.spare);
    pool.dispose();
  });

  it('skips a spare whose exit code says it is gone, even without a close event yet', () => {
    const pool = createCliWarmPool();
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);
    const first = spawned[0];
    if (first !== undefined) first.child.exitCode = 1;

    expect(pool.take('a')).toBeUndefined();
    expect(first?.remove).toHaveBeenCalled();
    pool.dispose();
  });

  it('discards a spare that failed to start', () => {
    const pool = createCliWarmPool();
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);
    spawned[0]?.child.emit('error', new Error('spawn claude ENOENT'));

    expect(pool.take('a')).toBeUndefined();
    expect(spawned[0]?.remove).toHaveBeenCalled();
    pool.dispose();
  });

  it('ignores a spawn that throws: the next call simply starts cold', () => {
    const pool = createCliWarmPool();

    expect(() => {
      pool.prime('a', () => {
        throw new Error('no space for the system file');
      });
    }).not.toThrow();
    expect(pool.take('a')).toBeUndefined();
    pool.dispose();
  });

  it('does not touch a spare after it was taken, when that child later exits', () => {
    const pool = createCliWarmPool();
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);
    pool.take('a');
    spawned[0]?.child.emit('close', 0, null);

    expect(spawned[0]?.remove).not.toHaveBeenCalled();
    pool.dispose();
  });

  it('kills every spare and removes every file on dispose, then primes nothing', () => {
    const pool = createCliWarmPool();
    const { spawn, spawned } = spawner();

    pool.prime('a', spawn);
    pool.prime('b', spawn);
    pool.dispose();

    for (const entry of spawned) {
      expect(entry.child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(entry.remove).toHaveBeenCalledTimes(1);
    }
    expect(pool.take('a')).toBeUndefined();
    pool.prime('c', spawn);
    expect(spawn).toHaveBeenCalledTimes(2);
  });
});
