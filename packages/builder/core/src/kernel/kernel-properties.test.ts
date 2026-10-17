import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isBuilderError, type BuilderDocument, type Transaction } from '@craftkit/builder-schema';

import { applyPatchSet } from '../patches/apply';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { createBuilder, type BuilderKernel } from './create-builder';

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'omega', 'nour', 'sama'] as const;
const CONTAINER_TYPES = new Set(['page', 'section', 'box']);

type OpSeed =
  | { kind: 'insert'; typePick: number; parentPick: number; indexPick: number }
  | { kind: 'setProp'; targetPick: number; wordPick: number }
  | { kind: 'remove'; targetPick: number }
  | { kind: 'move'; targetPick: number; parentPick: number; indexPick: number }
  | { kind: 'duplicate'; targetPick: number }
  | { kind: 'responsive'; targetPick: number; wordPick: number }
  | { kind: 'meta'; dirPick: number };

const opSeedArb: fc.Arbitrary<OpSeed> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('insert' as const),
      typePick: fc.nat(9),
      parentPick: fc.nat(30),
      indexPick: fc.nat(6),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('setProp' as const),
      targetPick: fc.nat(30),
      wordPick: fc.nat(7),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant('remove' as const), targetPick: fc.nat(30) }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('move' as const),
      targetPick: fc.nat(30),
      parentPick: fc.nat(30),
      indexPick: fc.nat(6),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant('duplicate' as const), targetPick: fc.nat(30) }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('responsive' as const),
      targetPick: fc.nat(30),
      wordPick: fc.nat(7),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('meta' as const), dirPick: fc.nat(1) }) },
);

/** Interpret an abstract seed against the CURRENT document, deterministically. */
function applyOp(kernel: BuilderKernel, op: OpSeed): void {
  const doc = kernel.getDocument();
  const ids = Object.keys(doc.nodes);
  const nonRoot = ids.filter((id) => id !== doc.rootId);
  const containers = ids.filter((id) => {
    const node = doc.nodes[id];
    return node !== undefined && CONTAINER_TYPES.has(node.type);
  });
  const pick = <T>(list: T[], seed: number): T | undefined =>
    list.length === 0 ? undefined : list[seed % list.length];

  try {
    switch (op.kind) {
      case 'insert': {
        const parentId = pick(containers, op.parentPick);
        if (parentId === undefined) return;
        const type = (['text', 'button', 'section', 'box', 'hero'] as const)[op.typePick % 5];
        if (type === undefined) return;
        kernel.dispatch('insertNode', { type, parentId, index: op.indexPick });
        return;
      }
      case 'setProp': {
        const target = pick(nonRoot, op.targetPick);
        if (target === undefined) return;
        const node = kernel.getDocument().nodes[target];
        if (node === undefined) return;
        const key =
          node.type === 'text'
            ? 'content'
            : node.type === 'button'
              ? 'label'
              : node.type === 'hero'
                ? 'heading'
                : node.type === 'section'
                  ? 'gap'
                  : 'padding';
        const value =
          node.type === 'section'
            ? (['sm', 'md', 'lg'] as const)[op.wordPick % 3]
            : node.type === 'box'
              ? (['none', 'tight', 'roomy'] as const)[op.wordPick % 3]
              : WORDS[op.wordPick % WORDS.length];
        if (value === undefined) return;
        kernel.dispatch('setProp', { id: target, key, value });
        return;
      }
      case 'remove': {
        const target = pick(nonRoot, op.targetPick);
        if (target === undefined) return;
        kernel.dispatch('removeNode', { id: target });
        return;
      }
      case 'move': {
        const target = pick(nonRoot, op.targetPick);
        const parentId = pick(containers, op.parentPick);
        if (target === undefined || parentId === undefined) return;
        kernel.dispatch('moveNode', { id: target, toParentId: parentId, toIndex: op.indexPick });
        return;
      }
      case 'duplicate': {
        const target = pick(nonRoot, op.targetPick);
        if (target === undefined) return;
        kernel.dispatch('duplicateNode', { id: target });
        return;
      }
      case 'responsive': {
        const target = pick(nonRoot, op.targetPick);
        if (target === undefined) return;
        const node = kernel.getDocument().nodes[target];
        if (node?.type !== 'text') return;
        const value = WORDS[op.wordPick % WORDS.length];
        if (value === undefined) return;
        kernel.dispatch('setResponsive', {
          id: target,
          breakpoint: op.wordPick % 2 === 0 ? 'tablet' : 'mobile',
          key: 'content',
          value,
        });
        return;
      }
      case 'meta': {
        kernel.dispatch('setDocMeta', { dir: op.dirPick === 0 ? 'ltr' : 'rtl' });
        return;
      }
    }
  } catch (error) {
    // Structurally rejected attempts are part of random exploration; the law is
    // that a rejection changes nothing — which the session-level assertions and
    // the dedicated no-partial-change tests verify.
    if (!isBuilderError(error)) {
      throw error;
    }
  }
}

function runSession(ops: OpSeed[]): {
  kernel: BuilderKernel;
  original: BuilderDocument;
  final: BuilderDocument;
  log: Transaction[];
} {
  const original = landingFixture();
  const kernel = createBuilder({
    document: original,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('prop') },
  });
  for (const op of ops) {
    applyOp(kernel, op);
  }
  return { kernel, original, final: kernel.getDocument(), log: [...kernel.transactions()] };
}

describe('property suites (SC-001, SC-002, SC-003 — ≥1,000 randomized sessions)', () => {
  it('undo-all restores the original, redo-all restores the final, replay reproduces the final, and identical seeds produce identical histories', () => {
    fc.assert(
      fc.property(fc.array(opSeedArb, { minLength: 5, maxLength: 25 }), (ops) => {
        const first = runSession(ops);

        // SC-001 — undo-all / redo-all round-trips exactly.
        while (first.kernel.undo()) {
          // drain
        }
        expect(first.kernel.getDocument()).toEqual(first.original);
        while (first.kernel.redo()) {
          // drain
        }
        expect(first.kernel.getDocument()).toEqual(first.final);

        // SC-002 — replaying the recorded log reproduces the final document.
        let replayed = first.original;
        for (const tx of first.log) {
          replayed = applyPatchSet(replayed, tx.patches);
        }
        expect(replayed).toEqual(first.final);

        // SC-003 — same seed, same ops ⇒ field-for-field identical history.
        const second = runSession(ops);
        expect(second.log).toEqual(first.log);
        expect(second.final).toEqual(first.final);

        // The session never leaves the document structurally broken.
        expect(first.kernel.validate()).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  }, 120_000);
});
