import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { NodeRect, RectIndex, SlotRect } from '../rects';
import { resolveDropTarget, seatOf, slotAccepts, type DragPayload } from './drop-resolver';

const NullRender: BlockRenderComponent = () => null;

const block = (type: string, slots?: Record<string, { allow: string[]; max?: number }>) => ({
  schema: defineBlockSchema({
    type,
    description: type,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'drop-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', { default: { allow: ['section', 'hero'] } }),
      block('section', { default: { allow: ['text', 'section'], max: 3 } }),
      block('hero', { actions: { allow: ['button'], max: 2 } }),
      block('text'),
      block('button'),
    ],
  },
};

// page(root) → [secA(default: t1, t2), hero1(actions: b1, b2 — FULL), secB(default: t3), secEmpty]
const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'page',
      props: {},
      slots: { default: ['secA', 'hero1', 'secB', 'secEmpty'] },
    },
    secA: { id: 'secA', type: 'section', props: {}, slots: { default: ['t1', 't2'] } },
    t1: { id: 't1', type: 'text', props: {} },
    t2: { id: 't2', type: 'text', props: {} },
    hero1: { id: 'hero1', type: 'hero', props: {}, slots: { actions: ['b1', 'b2'] } },
    b1: { id: 'b1', type: 'button', props: {} },
    b2: { id: 'b2', type: 'button', props: {} },
    secB: { id: 'secB', type: 'section', props: {}, slots: { default: ['t3'] } },
    t3: { id: 't3', type: 'text', props: {} },
    secEmpty: { id: 'secEmpty', type: 'section', props: {} },
  },
};

const MULTI_SLOT_VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'multi-slot-drop-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('multi-page', { default: { allow: ['three-slot'] } }),
      block('three-slot', {
        start: { allow: ['text', 'button'] },
        center: { allow: ['text'] },
        end: { allow: ['text', 'button'] },
      }),
      block('text'),
      block('button'),
    ],
  },
};

const MULTI_SLOT_DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'multi-page',
      props: {},
      slots: { default: ['layout'] },
    },
    layout: {
      id: 'layout',
      type: 'three-slot',
      props: {},
      slots: { start: ['startText'], end: ['endText'] },
    },
    startText: { id: 'startText', type: 'text', props: {} },
    endText: { id: 'endText', type: 'text', props: {} },
  },
};

function makeKernel(document: BuilderDocument = DOC) {
  return createBuilder({
    document,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('dr') },
  });
}

function makeMultiSlotKernel() {
  return createBuilder({
    document: MULTI_SLOT_DOC,
    extensions: [MULTI_SLOT_VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('multi-slot') },
  });
}

/** Stacked vertical layout: every node gets a known rect for band/half math. */
const RECTS: Record<string, NodeRect> = {
  root: { nodeId: 'root', x: 0, y: 0, width: 400, height: 800, version: 0 },
  secA: { nodeId: 'secA', x: 10, y: 10, width: 380, height: 200, version: 0 },
  t1: { nodeId: 't1', x: 20, y: 20, width: 360, height: 80, version: 0 },
  t2: { nodeId: 't2', x: 20, y: 110, width: 360, height: 80, version: 0 },
  hero1: { nodeId: 'hero1', x: 10, y: 220, width: 380, height: 150, version: 0 },
  b1: { nodeId: 'b1', x: 20, y: 230, width: 100, height: 40, version: 0 },
  b2: { nodeId: 'b2', x: 140, y: 230, width: 100, height: 40, version: 0 },
  secB: { nodeId: 'secB', x: 10, y: 380, width: 380, height: 150, version: 0 },
  t3: { nodeId: 't3', x: 20, y: 390, width: 360, height: 80, version: 0 },
  secEmpty: { nodeId: 'secEmpty', x: 10, y: 540, width: 380, height: 120, version: 0 },
};

const MULTI_SLOT_RECTS: Record<string, SlotRect> = {
  'layout/start': {
    ownerNodeId: 'layout',
    slotName: 'start',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    version: 0,
  },
  'layout/center': {
    ownerNodeId: 'layout',
    slotName: 'center',
    x: 100,
    y: 0,
    width: 100,
    height: 100,
    version: 0,
  },
  'layout/end': {
    ownerNodeId: 'layout',
    slotName: 'end',
    x: 200,
    y: 0,
    width: 100,
    height: 100,
    version: 0,
  },
};

const MULTI_NODE_RECTS: Record<string, NodeRect> = {
  root: { nodeId: 'root', x: 0, y: 0, width: 300, height: 100, version: 0 },
  layout: { nodeId: 'layout', x: 0, y: 0, width: 300, height: 100, version: 0 },
  startText: { nodeId: 'startText', x: 0, y: 0, width: 100, height: 100, version: 0 },
  endText: { nodeId: 'endText', x: 200, y: 0, width: 100, height: 100, version: 0 },
};

function stubIndex(
  hovered: () => string | undefined,
  nodeRects: Readonly<Record<string, NodeRect>> = RECTS,
  slotRects: Readonly<Record<string, SlotRect>> = {},
): RectIndex {
  return {
    attach: () => undefined,
    detach: () => undefined,
    rect: (id) => nodeRects[id],
    slotRect: (id, slot) => slotRects[`${id}/${slot}`],
    nodeAt: () => hovered(),
    has: (id) => id in nodeRects,
    element: () => undefined,
    version: () => 0,
    onInvalidate: () => () => undefined,
    stats: () => ({ measures: 0, invalidations: 0 }),
    dispose: () => undefined,
  };
}

function resolveOver(
  kernel: ReturnType<typeof makeKernel>,
  payload: DragPayload,
  hoveredId: string | undefined,
  y: number,
  x = 50,
) {
  return resolveDropTarget(
    kernel.getDocument(),
    kernel.context.registry,
    stubIndex(() => hoveredId),
    payload,
    x,
    y,
  );
}

describe('slotAccepts (contract §2 r2)', () => {
  const kernel = makeKernel();
  const doc = kernel.getDocument();
  const reg = kernel.context.registry;

  it('gates on allow lists', () => {
    expect(slotAccepts(doc, reg, 'secA', 'default', { kind: 'insert', type: 'text' })).toBe(true);
    expect(slotAccepts(doc, reg, 'secA', 'default', { kind: 'insert', type: 'button' })).toBe(
      false,
    );
    expect(slotAccepts(doc, reg, 'root', 'default', { kind: 'move', id: 't1' })).toBe(false);
  });

  it('gates on max, with the own-slot exemption for moves', () => {
    // hero1.actions is FULL (max 2)…
    expect(slotAccepts(doc, reg, 'hero1', 'actions', { kind: 'insert', type: 'button' })).toBe(
      false,
    );
    // …but b1 reordering within its own slot keeps its seat.
    expect(slotAccepts(doc, reg, 'hero1', 'actions', { kind: 'move', id: 'b1' })).toBe(true);
  });

  it('excludes self and descendants for move payloads', () => {
    expect(slotAccepts(doc, reg, 'secA', 'default', { kind: 'move', id: 'secA' })).toBe(false);
    // moving root's child section INTO its own child text's parent is fine,
    // but into itself is not; and a section cannot land inside its own subtree:
    expect(slotAccepts(doc, reg, 'secA', 'default', { kind: 'move', id: 'root' })).toBe(false);
  });

  it('rejects unknown slots and unknown parents', () => {
    expect(slotAccepts(doc, reg, 't1', 'default', { kind: 'insert', type: 'text' })).toBe(false);
    expect(slotAccepts(doc, reg, 'ghost', 'default', { kind: 'insert', type: 'text' })).toBe(false);
  });
});

describe('resolveDropTarget (contract §2 r1 — three-band rule)', () => {
  it.each([
    ['ltr', 'row', 25, 0], ['ltr', 'row', 370, 1],
    ['rtl', 'row', 25, 1], ['rtl', 'row', 370, 0],
    ['rtl', 'row-reverse', 25, 0],
  ] as const)('resolves horizontal sibling gaps in %s %s at x=%i', (dir, flexDirection, x, expected) => {
    const kernel = makeKernel();
    const owner = document.createElement('div');
    owner.style.display = 'flex';
    owner.style.flexDirection = flexDirection;
    owner.style.direction = dir;
    const slot = document.createElement('div');
    slot.dataset['bldrSlot'] = 'default';
    slot.dataset['bldrSlotOf'] = 'secA';
    owner.append(slot);
    document.body.append(owner);
    try {
      const index = { ...stubIndex(() => 't1'), element: (id: string) => id === 'secA' ? owner : undefined };
      const result = resolveDropTarget(kernel.getDocument(), kernel.context.registry, index, { kind: 'insert', type: 'text' }, x, 60);
      expect(result).toMatchObject({ parentId: 'secA', index: expected, indicatorRect: { width: 2, height: 80 } });
    } finally {
      owner.remove();
    }
  });
  it.each([[5, 0], [215, 1], [375, 2], [700, 4]])('places a root-padding drop at y=%i near the pointer, not always at the end', (y, expected) => {
    const kernel = makeKernel();
    const result = resolveOver(kernel, { kind: 'insert', type: 'section' }, 'root', y, 5);
    expect(result).toMatchObject({ parentId: 'root', slot: 'default', index: expected });
  });

  it('inserts in a container gap between children and adjusts same-slot moves', () => {
    const kernel = makeKernel();
    expect(resolveOver(kernel, { kind: 'insert', type: 'text' }, 'secA', 105, 15))
      .toMatchObject({ parentId: 'secA', index: 1 });
    expect(resolveOver(kernel, { kind: 'move', id: 't1' }, 'secA', 180, 15))
      .toMatchObject({ parentId: 'secA', index: 1 });
  });
  it('targets empty center and populated end slots by pointer geometry instead of schema order', () => {
    const kernel = makeMultiSlotKernel();
    const index = stubIndex(() => 'layout', MULTI_NODE_RECTS, MULTI_SLOT_RECTS);
    const payload: DragPayload = { kind: 'insert', type: 'text' };

    const center = resolveDropTarget(
      kernel.getDocument(),
      kernel.context.registry,
      index,
      payload,
      150,
      50,
    );
    const end = resolveDropTarget(
      kernel.getDocument(),
      kernel.context.registry,
      index,
      payload,
      250,
      50,
    );

    expect(center).toMatchObject({ parentId: 'layout', slot: 'center', index: 0 });
    expect(end).toMatchObject({ parentId: 'layout', slot: 'end', index: 1 });
  });

  it('keeps the single default slot through the first-accepting fallback', () => {
    const kernel = makeKernel();
    const outsideSlotRect: Record<string, SlotRect> = {
      'secEmpty/default': {
        ownerNodeId: 'secEmpty',
        slotName: 'default',
        x: 900,
        y: 900,
        width: 20,
        height: 20,
        version: 0,
      },
    };
    const resolved = resolveDropTarget(
      kernel.getDocument(),
      kernel.context.registry,
      stubIndex(() => 'secEmpty', RECTS, outsideSlotRect),
      { kind: 'insert', type: 'text' },
      50,
      600,
    );

    expect(resolved).toMatchObject({ parentId: 'secEmpty', slot: 'default', index: 0 });
  });

  it('never chooses a pointer-contained slot that refuses the payload', () => {
    const kernel = makeMultiSlotKernel();
    const resolved = resolveDropTarget(
      kernel.getDocument(),
      kernel.context.registry,
      stubIndex(() => 'layout', MULTI_NODE_RECTS, MULTI_SLOT_RECTS),
      { kind: 'insert', type: 'button' },
      150,
      50,
    );

    expect(resolved).toMatchObject({ parentId: 'layout', slot: 'start', index: 1 });
    expect(resolved?.slot).not.toBe('center');
  });

  it('outer quarters resolve sibling gaps: before above the midline, after below (US1/AC2)', () => {
    const kernel = makeKernel();
    const payload: DragPayload = { kind: 'move', id: 't3' };
    // t1 rect: y 20..100; top quarter ends at 40, bottom quarter starts at 80.
    const before = resolveOver(kernel, payload, 't1', 25);
    expect(before).toMatchObject({ parentId: 'secA', slot: 'default', index: 0 });
    const after = resolveOver(kernel, payload, 't1', 95);
    expect(after).toMatchObject({ parentId: 'secA', slot: 'default', index: 1 });
    expect(before?.indicatorRect.y).toBeLessThan(after?.indicatorRect.y ?? -1);
  });

  it('the middle band resolves an INTO-drop — an empty container is targetable (r1)', () => {
    const kernel = makeKernel();
    // secEmpty rect: y 540..660; middle band 570..630.
    const into = resolveOver(kernel, { kind: 'insert', type: 'text' }, 'secEmpty', 600);
    expect(into).toMatchObject({ parentId: 'secEmpty', slot: 'default', index: 0 });
  });

  it('walks the ancestor chain when the hovered node offers nothing', () => {
    const kernel = makeKernel();
    // Dragging a SECTION over a button (top quarter): hero1.actions rejects
    // sections and b1 has no slots, so resolution climbs to hero1's own gap
    // in root.default — which accepts sections.
    const resolved = resolveOver(kernel, { kind: 'move', id: 'secB' }, 'b1', 235);
    expect(resolved).toMatchObject({ parentId: 'root', slot: 'default' });
  });

  it('empty-canvas hover targets the document root', () => {
    const kernel = makeKernel();
    const resolved = resolveOver(kernel, { kind: 'insert', type: 'section' }, undefined, 700);
    expect(resolved).toMatchObject({ parentId: 'root', slot: 'default', index: 4 });
  });

  it('never offers a full slot to outside insert payloads mid-band', () => {
    const kernel = makeKernel();
    // hero1 middle band: actions is full ⇒ into rejected ⇒ falls to hero1's own gap in root.
    const resolved = resolveOver(kernel, { kind: 'insert', type: 'button' }, 'hero1', 295);
    expect(resolved?.parentId).not.toBe('hero1');
  });

  it('adjusts same-slot forward moves to post-removal indices (r4)', () => {
    const kernel = makeKernel();
    // Dragging t1 to AFTER t2 (raw index 2) — its own departure makes it 1.
    const resolved = resolveOver(kernel, { kind: 'move', id: 't1' }, 't2', 185);
    expect(resolved).toMatchObject({ parentId: 'secA', slot: 'default', index: 1 });
  });

  it('same-position resolution equals the current seat (both halves of own rect)', () => {
    const kernel = makeKernel();
    const seat = seatOf(kernel.getDocument(), 't1');
    const above = resolveOver(kernel, { kind: 'move', id: 't1' }, 't1', 25);
    const below = resolveOver(kernel, { kind: 'move', id: 't1' }, 't1', 95);
    expect(above).toMatchObject({ parentId: seat?.parentId, index: seat?.index });
    expect(below).toMatchObject({ parentId: seat?.parentId, index: seat?.index });
  });
});

describe('SC-003 — resolver≡door agreement (exhaustive deterministic sweep)', () => {
  it('every gate verdict matches the dispatch door, over every payload×parent×slot', () => {
    const base = makeKernel();
    const doc = base.getDocument();
    const reg = base.context.registry;
    const nodeIds = Object.keys(doc.nodes);
    const insertTypes = ['page', 'section', 'hero', 'text', 'button'];

    const payloads: DragPayload[] = [
      ...nodeIds.filter((id) => id !== 'root').map((id) => ({ kind: 'move', id }) as const),
      ...insertTypes.map((type) => ({ kind: 'insert', type }) as const),
    ];

    let checked = 0;
    for (const payload of payloads) {
      for (const parentId of nodeIds) {
        const slots = new Set([
          ...Object.keys(doc.nodes[parentId]?.slots ?? {}),
          ...Object.keys(reg.block(doc.nodes[parentId]?.type ?? '')?.schema.slots ?? {}),
        ]);
        for (const slot of slots) {
          const offered = slotAccepts(doc, reg, parentId, slot, payload);
          const kernel = makeKernel(); // fresh state per attempt
          let doorAccepted = true;
          try {
            if (payload.kind === 'move') {
              kernel.dispatch('moveNode', {
                id: payload.id,
                toParentId: parentId,
                toSlot: slot,
                toIndex: 0,
              });
            } else {
              kernel.dispatch('insertNode', {
                type: payload.type,
                parentId,
                slot,
                index: 0,
              });
            }
          } catch {
            doorAccepted = false;
          }
          expect(
            offered === doorAccepted,
            `disagreement: payload=${JSON.stringify(payload)} → ${parentId}/${slot}: gate=${String(
              offered,
            )} door=${String(doorAccepted)}`,
          ).toBe(true);
          checked += 1;
        }
      }
    }
    // 14 payloads (9 movable nodes + 5 insert types) × 5 slotted parents = the
    // COMPLETE space for this document; leaf parents contribute no slots.
    expect(checked).toBe(70);
  });
});

describe('SC-003 — generated-document sweep (contract r3, the named instrument)', () => {
  /** Deterministic LCG — no ambient randomness, identical documents every run. */
  const lcg = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  };

  /** Grow a random-but-VALID document through the real door (inserts only). */
  function generateDocument(seed: number) {
    const kernel = makeKernel({
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: {} } },
    });
    const rand = lcg(seed);
    const types = ['section', 'hero', 'text', 'button'];
    for (let step = 0; step < 12; step += 1) {
      const doc = kernel.getDocument();
      const reg = kernel.context.registry;
      const type = types[Math.floor(rand() * types.length)] ?? 'section';
      // Collect every slot that would accept this type, then pick one.
      const seats: { parentId: string; slot: string }[] = [];
      for (const parentId of Object.keys(doc.nodes)) {
        const decl = reg.block(doc.nodes[parentId]?.type ?? '')?.schema.slots ?? {};
        for (const slot of Object.keys(decl)) {
          if (slotAccepts(doc, reg, parentId, slot, { kind: 'insert', type })) {
            seats.push({ parentId, slot });
          }
        }
      }
      const seat = seats[Math.floor(rand() * seats.length)];
      if (seat !== undefined) {
        kernel.dispatch('insertNode', { type, parentId: seat.parentId, slot: seat.slot });
      }
    }
    return kernel;
  }

  it(
    'over 20 generated documents, every RESOLVED target dispatches cleanly through the door',
    { timeout: 20_000 },
    () => {
      let resolutions = 0;
      let documentsWithDepth = 0;
      for (let seed = 1; seed <= 20; seed += 1) {
        const source = generateDocument(seed * 7919);
        const doc = source.getDocument();
        const reg = source.context.registry;
        const ids = Object.keys(doc.nodes);
        const probe = makeKernel(doc); // shared probe; every success is undone
        if (
          ids.some((id) => (doc.nodes[id]?.slots?.['default']?.length ?? 0) > 0 && id !== 'root')
        ) {
          documentsWithDepth += 1;
        }
        const payloads = [
          ...ids.filter((id) => id !== 'root').map((id) => ({ kind: 'move', id }) as const),
          { kind: 'insert', type: 'section' } as const,
          { kind: 'insert', type: 'button' } as const,
        ];
        // Every node's rect is the same fixed box (generated ids are not in the
        // static RECTS table): y=7/15/23 exercise the three bands (gap-before,
        // into, gap-after) of whichever node is hovered.
        const boxIndex = (hovered: string): RectIndex => ({
          attach: () => undefined,
          detach: () => undefined,
          rect: (id) => ({ nodeId: id, x: 5, y: 5, width: 20, height: 20, version: 0 }),
          nodeAt: () => hovered,
          has: () => true,
          element: () => undefined,
          version: () => 0,
          onInvalidate: () => () => undefined,
          stats: () => ({ measures: 0, invalidations: 0 }),
          dispose: () => undefined,
        });
        for (const payload of payloads) {
          for (const hovered of ids) {
            for (const y of [7, 15, 23]) {
              const resolved = resolveDropTarget(doc, reg, boxIndex(hovered), payload, 10, y);
              if (resolved === null) {
                continue;
              }
              resolutions += 1;
              // The RESOLVER'S OWN OUTPUT (parent, slot, index) must clear the
              // door. ONE probe kernel per document + undo after each success —
              // building a kernel per attempt made the sweep time out under
              // parallel coverage instrumentation.
              if (payload.kind === 'move') {
                probe.dispatch('moveNode', {
                  id: payload.id,
                  toParentId: resolved.parentId,
                  toSlot: resolved.slot,
                  toIndex: resolved.index,
                });
              } else {
                probe.dispatch('insertNode', {
                  type: payload.type,
                  parentId: resolved.parentId,
                  slot: resolved.slot,
                  index: resolved.index,
                });
              }
              probe.undo(); // one transaction in, one inverse out — state restored
            }
          }
        }
      }
      expect(resolutions).toBeGreaterThan(400); // the sweep genuinely resolved at scale
      expect(documentsWithDepth).toBeGreaterThan(10); // generated docs actually nest
    },
  );
});
