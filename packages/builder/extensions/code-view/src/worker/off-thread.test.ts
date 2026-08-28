import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { stressDocument } from '@craftkit/builder-core/testing';
import { CANONICAL_JSON_PROJECTION_ID } from '@craftkit/builder-transforms';

import { createTransformWorkerClient, type WorkerLike } from './client';
import type { TransformRequestInput } from './client';

/**
 * SC-005 — the codec never runs on the path that renders the canvas.
 *
 * This is the law FR-009 exists for, and it is the one a reviewer cannot take
 * on trust: "we put it in a worker" is a claim about a file, not about what
 * actually executes. So it is proven twice, from opposite directions.
 *
 *   STATICALLY — the main-thread modules must not even be able to reach the
 *   codec: if `@craftkit/builder-transforms` appears nowhere in their import
 *   graph, no bundler can place it on the rendering path, and no future edit
 *   can quietly call it there without this test noticing.
 *
 *   DYNAMICALLY — a burst of typing through the real client must produce ZERO
 *   codec invocations in this (main-thread) realm, no matter how many messages
 *   it posts.
 *
 * Timing is deliberately absent. A wall-clock budget would rot in CI; a call
 * count of zero cannot.
 */

const sourceOf = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** The modules that run on the main thread. The worker entry is NOT one of them. */
const MAIN_THREAD_MODULES = ['./client.ts', './protocol.ts'] as const;

const silentWorker = (): WorkerLike & { posted: unknown[] } => {
  const posted: unknown[] = [];
  return {
    posted,
    postMessage: (message: unknown) => {
      posted.push(message);
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    terminate: () => undefined,
  };
};

const parseInput = (generation: number, payload: string): TransformRequestInput => ({
  operation: 'parse',
  generation,
  baseRevision: 1,
  scope: { kind: 'document' },
  projectionId: CANONICAL_JSON_PROJECTION_ID,
  payload,
});

/**
 * Fire an input the way typing does — and SWALLOW the supersede rejection.
 * A coalesced request is rejected by design (that is `w2` working), so an
 * unhandled rejection here would be the test lying about the client, not a
 * defect in it.
 */
const type = (
  client: { request: (input: TransformRequestInput) => Promise<unknown> },
  input: TransformRequestInput,
): void => {
  client.request(input).catch(() => undefined);
};

describe('SC-005 — the codec never runs on the rendering path', () => {
  it.each(MAIN_THREAD_MODULES)(
    'STATIC: %s cannot reach the transforms package at all',
    (module) => {
      // Not a style rule — a placement guarantee. What a module cannot import,
      // a bundler cannot put on the main thread.
      expect(sourceOf(module)).not.toContain('builder-transforms');
    },
  );

  it('STATIC: only the worker entry imports the codec, and it does so downward', () => {
    // The single legitimate importer. If this ever stops being true, the law
    // has moved and someone must say so deliberately.
    expect(sourceOf('./transform-worker.ts')).toContain('@craftkit/builder-transforms');
  });

  it('DYNAMIC: a typing burst posts messages and invokes the codec ZERO times here', async () => {
    // Spy on the real module: if any main-thread code path called it, the
    // counter would move. It must not, however many keystrokes arrive.
    const codec = await import('@craftkit/builder-transforms');
    const project = vi.spyOn(codec, 'projectDocument');
    const parse = vi.spyOn(codec, 'parseDocument');

    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ document: stressDocument(1000), blockTypes: [] }));

    for (let keystroke = 1; keystroke <= 24; keystroke += 1) {
      type(client, parseInput(keystroke, `{"typed": ${String(keystroke)}}`));
    }

    expect(project).toHaveBeenCalledTimes(0);
    expect(parse).toHaveBeenCalledTimes(0);
    // …and the work really was dispatched, so the zero above is not vacuous.
    expect(worker.posted.length).toBeGreaterThan(0);
    project.mockRestore();
    parse.mockRestore();
    client.terminate();
  });

  it('DYNAMIC: the 1,000-node document crosses ONCE, and typing carries text only (w4)', () => {
    // Trap 6: cloning the whole document per keystroke stalls a large page even
    // though the parse itself is off-thread. Counted in messages, not bytes-per-
    // second, so the gate cannot drift with hardware.
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    const snapshot = JSON.stringify({ document: stressDocument(1000), blockTypes: [] });

    client.setDocument(1, snapshot);
    for (let keystroke = 1; keystroke <= 12; keystroke += 1) {
      type(client, parseInput(keystroke, `{"typed": ${String(keystroke)}}`));
    }
    // Re-sending the SAME revision is a no-op: the worker already holds it.
    client.setDocument(1, snapshot);

    const counts = client.getSnapshot().counts;
    expect(counts.documentPosts).toBe(1);
    expect(counts.requestPosts).toBeGreaterThan(0);
    client.terminate();
  });

  it('DYNAMIC: one ENORMOUS paste is one coalesced request, not per-character work', () => {
    // Spec edge case 2 (analysis C5): a paste is a single input event carrying a
    // large payload — it must never be amplified into per-character requests.
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ document: stressDocument(50), blockTypes: [] }));

    const huge = `{"pasted": "${'x'.repeat(200_000)}"}`;
    type(client, parseInput(1, huge));

    const snapshot = client.getSnapshot();
    // One active request; nothing queued behind it, and no fan-out by length.
    expect(snapshot.active).not.toBeNull();
    expect(snapshot.coalesced).toBeNull();
    expect(snapshot.counts.requestPosts).toBe(1);
    client.terminate();
  });

  it('DYNAMIC: a burst holds at most ONE active plus ONE coalesced, whatever its size', () => {
    const worker = silentWorker();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, JSON.stringify({ document: stressDocument(50), blockTypes: [] }));

    for (let keystroke = 1; keystroke <= 40; keystroke += 1) {
      type(client, parseInput(keystroke, `{"typed": ${String(keystroke)}}`));
    }

    const snapshot = client.getSnapshot();
    expect(snapshot.active).not.toBeNull();
    expect(snapshot.coalesced?.generation).toBe(40); // the NEWEST input survives
    // 40 keystrokes did not become 40 posted requests.
    expect(snapshot.counts.requestPosts).toBeLessThanOrEqual(2);
    client.terminate();
  });
});
