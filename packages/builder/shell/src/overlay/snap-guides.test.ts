import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import {
  alignmentGuides,
  computeSnap,
  insetMoveIntents,
  moveTreeElementBy,
  nudgeDelta,
} from './snap-guides';
import { permissiveUtilityOracle, storedTree, treeKernel } from './tree-test-kit';

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

describe('snap guides (DESIGN §A.6)', () => {
  it('snaps a moving box to a sibling edge within 6px and draws the guide', () => {
    const snap = computeSnap({ x: 104, y: 300, width: 50, height: 20 }, [{ x: 100, y: 0, width: 80, height: 40 }]);
    expect(snap.dx).toBe(-4);
    expect(snap.guides[0]).toMatchObject({ x: 100, width: 0 });
  });

  it('does not snap beyond the threshold', () => {
    const snap = computeSnap({ x: 120, y: 300, width: 50, height: 20 }, [{ x: 100, y: 0, width: 10, height: 10 }]);
    expect(snap).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps a centre to the parent centre', () => {
    // Box centre 152 vs parent centre 150: within 6px, so it lands on the centre.
    const snap = computeSnap({ x: 102, y: 500, width: 100, height: 20 }, [{ x: 0, y: 0, width: 300, height: 400 }]);
    expect(snap.dx).toBe(-2);
  });

  it('finds the edges siblings share for reorder guides', () => {
    const guides = alignmentGuides(
      [
        { x: 10, y: 0, width: 100, height: 20 },
        { x: 10, y: 30, width: 60, height: 20 },
      ],
      { x: 0, y: 0, width: 300, height: 100 },
    );
    expect(guides).toContainEqual({ x: 10, y: 0, width: 0, height: 100 });
  });

  it('nudges 1px, Shift 10px', () => {
    expect(nudgeDelta('ArrowRight', false)).toEqual({ dx: 1, dy: 0 });
    expect(nudgeDelta('ArrowUp', true)).toEqual({ dx: 0, dy: -10 });
  });

  it('mirrors the inline axis on an RTL page: moving right shrinks inline-start', () => {
    const at = { bucket: 'base' as const, state: 'default' as const };
    const ltr = insetMoveIntents('absolute inset-s-[20px]', { dx: 10, dy: 0 }, { ...at, dir: 'ltr' }, { inlineStart: 20, blockStart: 0 });
    const rtl = insetMoveIntents('absolute inset-s-[20px]', { dx: 10, dy: 0 }, { ...at, dir: 'rtl' }, { inlineStart: 20, blockStart: 0 });
    expect(ltr[0]?.value).toEqual({ kind: 'raw', css: '30px' });
    expect(rtl[0]?.value).toEqual({ kind: 'raw', css: '10px' });
    expect(ltr[0]?.side).toBe('inline-start');
  });

  it('a move writes logical inset classes as one transaction', () => {
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'absolute', text: 'Badge' }],
    };
    const kernel = treeKernel([tree], 'rtl');
    const result = moveTreeElementBy(
      kernel,
      { kind: 'tree', nodeId: 'r1', path: [0] },
      { dx: 10, dy: 5 },
      { dir: 'rtl', measured: { inlineStart: 40, blockStart: 0 } },
    );
    expect(result.ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    const node = storedTree(kernel).children[0];
    const className = node?.kind === 'element' ? (node.className ?? '') : '';
    expect(className).toContain('absolute');
    expect(className).toMatch(/inset-s-\[30px\]/u);
    expect(className).toMatch(/inset-bs-\[5px\]/u);
  });
});
