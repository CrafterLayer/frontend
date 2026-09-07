import { describe, expect, it } from 'vitest';

import { BuilderError, type JsonValue } from '@craftkit/builder-schema';

import * as corePublicApi from '../index';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture, stressDocument } from '../testing/fixtures';
import { createBuilder } from './create-builder';

function testKernel(document = landingFixture()) {
  return createBuilder({
    document,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('law') },
  });
}

describe('Law J — JSON purity at the door', () => {
  it.each([
    ['a function', () => null],
    ['undefined', undefined],
    ['a bigint', 1n],
    ['NaN', Number.NaN],
  ])('rejects %s as a prop value with zero partial change', (_label, poison) => {
    const kernel = testKernel();
    const before = kernel.getDocument();
    expect(() =>
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: poison as never }),
    ).toThrow(BuilderError);
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('names the offending code for each poison kind', () => {
    const kernel = testKernel();
    const codeFor = (poison: unknown): string => {
      try {
        kernel.dispatch('setProp', { id: 'p1', key: 'content', value: poison as never });
        return 'accepted';
      } catch (error) {
        return (error as BuilderError).code;
      }
    };
    // zod's JsonValue mirror rejects these at parse time — inside the door:
    expect(codeFor(() => null)).toBe('cmd/invalid-args');
    expect(codeFor(undefined)).toBe('cmd/invalid-args');
    expect(codeFor(1n)).toBe('cmd/invalid-args');
    expect(codeFor(Number.NaN)).toBe('cmd/invalid-args');
  });

  it('canonicalises -0 to 0 at the door — normalised, never rejected (011 R2)', () => {
    // -0 passes the finite-number guard yet JSON prints it as "0", so it could
    // never survive a textual round trip. The door normalises it BEFORE the
    // handler runs; the stored value is exactly 0.
    const kernel = testKernel();
    kernel.dispatch('setProp', { id: 'p1', key: 'weight', value: -0 });
    const stored = kernel.getDocument().nodes['p1']?.props['weight'];
    expect(Object.is(stored, 0)).toBe(true);
    expect(Object.is(stored, -0)).toBe(false);
    expect(kernel.transactions()).toHaveLength(1); // a real change, one transaction
  });

  it('canonicalises -0 on OPEN — an existing stored document is repaired, not refused', () => {
    const document = landingFixture();
    const carrier = document.nodes['p1'];
    if (carrier === undefined) {
      throw new Error('fixture must contain p1');
    }
    carrier.props['weight'] = -0;
    const kernel = testKernel(document);
    const stored = kernel.getDocument().nodes['p1']?.props['weight'];
    expect(Object.is(stored, 0)).toBe(true);
    expect(kernel.transactions()).toHaveLength(0); // opening is not an edit
  });
});

describe('Law S — sealed store', () => {
  it('exposes no raw store, no setState, and no store factory from the public API', () => {
    expect(Object.keys(corePublicApi)).not.toContain('createKernelStore');
    const kernel = testKernel();
    const facade = kernel.context.store as unknown as Record<string, unknown>;
    expect(facade['setState']).toBeUndefined();
    expect(facade['getInitialState']).toBeUndefined();
    expect(Object.keys(facade).sort()).toEqual([
      'getState',
      'select',
      'subscribe',
      'subscribeNode',
    ]);
  });

  it('pairs every observable document change 1:1 with a transaction (audit)', () => {
    const kernel = testKernel();
    let stateChanges = 0;
    let txApplied = 0;
    let historyEvents = 0;
    kernel.context.store.subscribe(() => {
      stateChanges += 1;
    });
    kernel.context.events.on('tx.applied', () => {
      txApplied += 1;
    });
    kernel.context.events.on('history.undone', () => {
      historyEvents += 1;
    });
    kernel.context.events.on('history.redone', () => {
      historyEvents += 1;
    });

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    try {
      kernel.dispatch('insertNode', { type: 'text', parentId: 'ghost' });
    } catch {
      // rejected — must not surface as a state change
    }
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' }); // no-effect
    kernel.undo();
    kernel.redo();
    kernel.setSelection(['p1']); // kernel state, not a document change

    // 2 commands + 1 undo + 1 redo + 1 selection write = 5 state notifications;
    // document-observable ones = txApplied (2) + history applications (2).
    expect(txApplied).toBe(2);
    expect(historyEvents).toBe(2);
    expect(stateChanges).toBe(5);
  });

  it('the transaction log is already complete AT the store notification (007 fix)', () => {
    // React's useSyncExternalStore checks snapshots SYNCHRONOUSLY inside the
    // notification: a subscriber deriving from the log (transactions().length)
    // must see the new transaction THEN, or its change-check bails out and the
    // view lags one event behind forever. Found by the B3a playground counter.
    const kernel = testKernel();
    const seenAtNotify: number[] = [];
    kernel.context.store.subscribe(() => {
      seenAtNotify.push(kernel.transactions().length);
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    expect(seenAtNotify).toEqual([1]); // not [0] — the log precedes the write
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Two' });
    expect(seenAtNotify).toEqual([1, 2]);
  });
});

describe('Selection is bookkeeping over LIVE nodes', () => {
  it('a command or undo that removes the selected node prunes the dangling id', () => {
    const kernel = testKernel();
    kernel.setSelection(['p1', 'hero1']);

    kernel.dispatch('removeNode', { id: 'p1' });
    expect(kernel.context.store.getState().selection).toEqual(['hero1']);

    // Redo-ing the removal re-prunes; undoing does NOT resurrect the selection
    // (selection is ephemeral UI state, never part of the document history).
    kernel.undo();
    expect(kernel.getDocument().nodes['p1']).toBeDefined();
    expect(kernel.context.store.getState().selection).toEqual(['hero1']);
  });

  it('keeps the selection array reference stable when nothing was dropped', () => {
    const kernel = testKernel();
    kernel.setSelection(['hero1']);
    const before = kernel.context.store.getState().selection;

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'unrelated' });
    // Reference identity matters: selection subscribers must not churn on
    // every unrelated command.
    expect(kernel.context.store.getState().selection).toBe(before);
  });

  it('pruning happens inside the same write — no extra notification (Law S)', () => {
    const kernel = testKernel();
    kernel.setSelection(['p1']);
    let stateChanges = 0;
    kernel.context.store.subscribe(() => {
      stateChanges += 1;
    });
    kernel.dispatch('removeNode', { id: 'p1' });
    expect(kernel.context.store.getState().selection).toEqual([]);
    expect(stateChanges).toBe(1); // one command ⇒ exactly one observable change
  });
});

describe('FR-019 — scoped notification on the 1,000-node stress document', () => {
  it('a single setProp notifies exactly one node subscriber and no others', () => {
    const kernel = testKernel(stressDocument(1000));
    expect(Object.keys(kernel.getDocument().nodes)).toHaveLength(1000);

    const counts = new Map<string, number>();
    const watched = [
      'txt-1-1',
      'txt-1-2',
      'txt-2-1',
      'txt-3-5',
      'sec-1',
      'sec-2',
      'root',
      'txt-10-9',
    ];
    for (const id of watched) {
      counts.set(id, 0);
      kernel.context.store.subscribeNode(id, () => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });
    }

    kernel.dispatch('setProp', { id: 'txt-1-1', key: 'content', value: 'Hot path.' });

    expect(counts.get('txt-1-1')).toBe(1);
    for (const id of watched.filter((watchedId) => watchedId !== 'txt-1-1')) {
      expect(counts.get(id)).toBe(0);
    }
  });

  /*
    Not vitest's 5 s default. This test's work is constant (fixed inputs);
    what varies is spare CPU. Under `pnpm test` — every package's vitest in
    parallel on the same cores — it was killed by the clock at 5 s while
    passing comfortably alone, and turbo then skipped every dependent package.
    A timing GUARD that fails on a busy machine guards nothing; the assertions
    inside still hold the property, this only stops the clock lying about it.
  */
  const LOAD_TOLERANT_TIMEOUT_MS = 30_000;
  it(
    'structural validation scales linearly on the stress document (SC-006 guard)',
    () => {
      // SC-006's absolute "<150 ms" is recorded by the uncontended evidence run;
      // wall-clock assertions are Lane-B and would flake here, where turbo runs
      // several coverage-instrumented vitest processes in parallel. The merge
      // gate instead proves the property that GUARANTEES the budget: near-linear
      // cost. Ten 100-node validations do the same node work as one 1,000-node
      // validation, and interleaved rounds share whatever machine load exists,
      // so the ratio is load-invariant. A superlinear validator (O(n^2) would
      // put the ratio near 10) fails deterministically.
      const small = testKernel(stressDocument(100));
      const big = testKernel(stressDocument(1000));
      expect(big.validate()).toEqual([]);

      let smallBest = Number.POSITIVE_INFINITY;
      let bigBest = Number.POSITIVE_INFINITY;
      for (let round = 0; round < 5; round += 1) {
        let startedAt = Date.now();
        for (let run = 0; run < 10; run += 1) {
          small.validate();
        }
        smallBest = Math.min(smallBest, Date.now() - startedAt);
        startedAt = Date.now();
        big.validate();
        bigBest = Math.min(bigBest, Date.now() - startedAt);
      }
      expect(bigBest).toBeLessThan(Math.max(3 * smallBest, 20));
      /*
      Catastrophic-regression backstop. This is the ONE wall-clock assertion
      the comment above warns against, and it kept the warning's promise: at
      2000ms it flaked under `pnpm test`, where turbo runs every package's
      vitest in parallel. Measured on the same machine, `big.validate()` costs
      32ms in isolation and was observed past 2000ms under that contention —
      a 60× inflation from scheduling alone, with the ratio above holding at
      1.19 throughout. The ratio is the deterministic guard; this number only
      has to catch a uniform collapse (both sizes slow together, which the
      ratio cannot see) without tripping on a busy CI box. 20s does both: a
      600× uniform regression still fails, contention does not.
    */
      expect(bigBest).toBeLessThan(20_000);
    },
    LOAD_TOLERANT_TIMEOUT_MS,
  );
});

describe('patch-shape assertion — commands touch only their paths', () => {
  it('setProp emits exactly one replace patch under the target key', () => {
    const kernel = testKernel();
    const tx = kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Surgical.' });
    expect(tx.patches).toEqual([
      {
        op: 'replace',
        path: ['nodes', 'p1', 'props', 'content'],
        value: 'Surgical.' satisfies JsonValue,
      },
    ]);
    expect(tx.inverse).toEqual([
      { op: 'replace', path: ['nodes', 'p1', 'props', 'content'], value: 'Welcome aboard.' },
    ]);
  });
});
