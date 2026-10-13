/**
 * Smarter live workers (2026-10-12): the writers' pool halves on "too many at once" and grows
 * back one writer at a time, and the provider wrapper is what tells it. Ours to prove: halving
 * (never below one, one halving per burst), the slow climb back to the ceiling, a reduced limit
 * holding new writers back and a grown one letting a waiter in, and which provider answers count
 * as congestion.
 */
import { describe, expect, it, vi } from 'vitest';

import { remoteStatusError } from '../provider/remote-errors';
import type { AiPlan, AiPlanProvider } from '../types';
import { congestionAwareProvider, isCongestion } from './writer-congestion';
import { createAiWriterPool } from './writer-pool';

function clock(start = 0) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

describe('the pool under congestion', () => {
  it('halves once per burst, never below one', () => {
    const time = clock();
    const pool = createAiWriterPool(6, time);
    pool.congested();
    pool.congested(); // the same burst: every writer hit the same limit
    expect(pool.limit).toBe(3);
    time.advance(2_500);
    pool.congested();
    expect(pool.limit).toBe(1);
    time.advance(2_500);
    pool.congested();
    expect(pool.limit).toBe(1);
    expect(pool.ceiling).toBe(6);
  });

  it('climbs back one writer per `limit` answers, up to its ceiling', () => {
    const time = clock();
    const pool = createAiWriterPool(4, time);
    pool.congested();
    expect(pool.limit).toBe(2);
    pool.succeeded();
    expect(pool.limit).toBe(2);
    pool.succeeded();
    expect(pool.limit).toBe(3);
    for (let i = 0; i < 3; i += 1) pool.succeeded();
    expect(pool.limit).toBe(4);
    for (let i = 0; i < 10; i += 1) pool.succeeded();
    expect(pool.limit).toBe(4);
  });

  it('holds new writers back at the lower limit, and lets a waiter in when it grows', async () => {
    const time = clock();
    const pool = createAiWriterPool(2, time);
    const first = await pool.acquire();
    pool.congested();
    expect(pool.limit).toBe(1);
    let admitted = false;
    const waiting = pool.acquire().then((permit) => {
      admitted = true;
      return permit;
    });
    await Promise.resolve();
    expect(admitted).toBe(false);
    pool.succeeded(); // one answer at limit 1: back to 2, and the waiter goes in
    await waiting;
    expect(admitted).toBe(true);
    expect(pool.active).toBe(2);
    first.release();
  });
});

describe('isCongestion', () => {
  it('reads rate limits, overloads and busy servers as congestion, nothing else', () => {
    expect(isCongestion(remoteStatusError(429))).toBe(true);
    expect(isCongestion(remoteStatusError(529))).toBe(true);
    expect(isCongestion(remoteStatusError(503))).toBe(true);
    expect(isCongestion(Object.assign(new Error('overloaded'), { status: 529 }))).toBe(true);
    expect(isCongestion(remoteStatusError(500))).toBe(false);
    expect(isCongestion(remoteStatusError(400))).toBe(false);
    expect(isCongestion(new Error('network'))).toBe(false);
    expect(isCongestion(undefined)).toBe(false);
  });
});

describe('congestionAwareProvider', () => {
  const PLAN = { commands: [] } as unknown as AiPlan;

  class Provider implements AiPlanProvider {
    readonly name = 'class-based';
    constructor(private readonly answer: () => Promise<AiPlan>) {}
    propose(): Promise<AiPlan> {
      return this.answer();
    }
    describe(): string {
      return this.name;
    }
  }

  it('reports answers and congestion to the pool and passes everything else through', async () => {
    const pool = createAiWriterPool(4);
    const congested = vi.spyOn(pool, 'congested');
    const succeeded = vi.spyOn(pool, 'succeeded');
    let next: () => Promise<AiPlan> = () => Promise.resolve(PLAN);
    const inner = new Provider(() => next());
    const watched = congestionAwareProvider(inner, pool) as Provider;

    await expect(watched.propose()).resolves.toBe(PLAN);
    expect(succeeded).toHaveBeenCalledTimes(1);

    next = () => Promise.reject(remoteStatusError(429));
    await expect(watched.propose()).rejects.toMatchObject({ status: 429 });
    expect(congested).toHaveBeenCalledTimes(1);

    next = () => Promise.reject(remoteStatusError(500));
    await expect(watched.propose()).rejects.toMatchObject({ status: 500 });
    expect(congested).toHaveBeenCalledTimes(1);

    // A class-based provider keeps its own members and methods.
    expect(watched.describe()).toBe('class-based');
    expect('repair' in watched).toBe(false);
  });
});
