import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { NodeRect, RectIndex } from '../rects';
import { createDragSession } from './drag-session';

const NullRender: BlockRenderComponent = () => null;
const TEXT_DESCRIPTION =
  'A text block for long-form catalogue copy. This prose explains authoring intent and usage in detail.';
const block = (
  type: string,
  slots?: Record<string, { allow: string[]; max?: number }>,
  description = `${type[0]?.toUpperCase() ?? ''}${type.slice(1)}`,
) => ({
  schema: defineBlockSchema({
    type,
    description,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'session-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', { default: { allow: ['section', 'hero'] } }),
      block('section', { default: { allow: ['text'] } }),
      block('hero', { actions: { allow: ['button'], max: 2 } }),
      block('button'),
      block('text', undefined, TEXT_DESCRIPTION),
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1', 'hero1', 's2'] } },
    s1: { id: 's1', type: 'section', props: {}, slots: { default: ['t1', 't2'] } },
    t1: { id: 't1', type: 'text', props: {} },
    t2: { id: 't2', type: 'text', props: {} },
    hero1: { id: 'hero1', type: 'hero', props: {}, slots: { actions: ['b1', 'b2'] } },
    b1: { id: 'b1', type: 'button', props: {} },
    b2: { id: 'b2', type: 'button', props: {} },
    s2: { id: 's2', type: 'section', props: {} },
  },
};

const RECTS: Record<string, NodeRect> = {
  root: { nodeId: 'root', x: 0, y: 0, width: 400, height: 600, version: 0 },
  s1: { nodeId: 's1', x: 10, y: 10, width: 380, height: 250, version: 0 },
  t1: { nodeId: 't1', x: 20, y: 20, width: 360, height: 100, version: 0 },
  t2: { nodeId: 't2', x: 20, y: 130, width: 360, height: 100, version: 0 },
  hero1: { nodeId: 'hero1', x: 10, y: 270, width: 380, height: 100, version: 0 },
  b1: { nodeId: 'b1', x: 20, y: 280, width: 100, height: 40, version: 0 },
  b2: { nodeId: 'b2', x: 140, y: 280, width: 100, height: 40, version: 0 },
  s2: { nodeId: 's2', x: 10, y: 380, width: 380, height: 150, version: 0 },
};

function setup() {
  const kernel = createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ds') },
  });
  const layer = document.createElement('div');
  const queue: (() => void)[] = [];
  let hovered: string | undefined;
  const invalidateListeners = new Set<() => void>();
  const index: RectIndex = {
    attach: () => undefined,
    detach: () => undefined,
    rect: (id) => RECTS[id],
    nodeAt: () => hovered,
    has: (id) => id in RECTS,
    element: () => undefined,
    version: () => 0,
    onInvalidate: (listener) => {
      invalidateListeners.add(listener);
      return () => invalidateListeners.delete(listener);
    },
    stats: () => ({ measures: 0, invalidations: 0 }),
    dispose: () => undefined,
  };
  const announcements: string[] = [];
  const suppressions: boolean[] = [];
  const session = createDragSession({
    kernel,
    index,
    layer,
    schedule: (callback) => {
      queue.push(callback);
      return () => undefined;
    },
    viewport: () => ({ width: 400, height: 600 }),
    announce: (message) => announcements.push(message),
    onHoverSuppress: (active) => suppressions.push(active),
  });
  const tick = () => {
    queue.splice(0).forEach((callback) => {
      callback();
    });
  };
  const setHovered = (id: string | undefined) => {
    hovered = id;
  };
  const invalidate = () => {
    for (const listener of invalidateListeners) {
      listener();
    }
  };
  return { kernel, layer, session, tick, setHovered, invalidate, announcements, suppressions };
}

describe('createDragSession (006 contract §1)', () => {
  it('a library element dropped outside a tree uses the precise block seat', () => {
    const h = setup();
    const onDrop = vi.fn();
    h.setHovered('root');
    h.session.press({ kind: 'tree-insert', node: { kind: 'element', tag: 'h2', text: 'Heading' }, label: 'Heading', fallback: { kind: 'insert', type: 'section', onDrop } }, -50, 50, 'handle');
    h.session.move(5, 265);
    h.session.release();
    expect(onDrop).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ parentId: 'root', slot: 'default', index: 1 }));
    expect(h.kernel.transactions()).toHaveLength(0);
    h.session.dispose();
  });

  it('does not invoke a library drop callback after Escape or an outside release', () => {
    const h = setup();
    const onDrop = vi.fn();
    h.session.press({ kind: 'insert', type: 'section', onDrop }, -50, 50, 'handle');
    h.session.move(50, 265);
    h.session.cancel();
    h.session.release();
    h.session.press({ kind: 'insert', type: 'section', onDrop }, -50, 50, 'handle');
    h.session.move(450, 265);
    h.session.release();
    expect(onDrop).not.toHaveBeenCalled();
    expect(h.kernel.transactions()).toHaveLength(0);
    h.session.dispose();
  });
  it('s1: a press without crossing the threshold is a plain click — no chrome ever', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 50, 50, 'handle');
    h.session.move(57, 50); // under 8px
    expect(h.session.phase()).toBe('pending');
    expect(h.layer.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).not.toBe(
      'visible',
    );
    h.session.release();
    expect(h.session.phase()).toBe('idle');
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.suppressions).toEqual([]); // hover never suppressed
  });

  it('starts structural movement only from its handle and after a full 8px', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 50, 50, 'surface');
    h.session.move(100, 100);
    expect(h.session.phase()).toBe('idle');

    h.session.press({ kind: 'move', id: 't1' }, 50, 50, 'handle');
    h.session.move(57.9, 50);
    expect(h.session.phase()).toBe('pending');
    h.session.move(58, 50);
    expect(h.session.phase()).toBe('active');
  });

  it('s2+s3: active drag is chrome-only; drop dispatches EXACTLY ONE moveNode', () => {
    const h = setup();
    const before = h.kernel.getDocument();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(90, 90); // activates
    expect(h.session.phase()).toBe('active');
    expect(h.suppressions).toEqual([true]);
    expect(h.kernel.getDocument()).toBe(before); // chrome-only so far

    h.setHovered('t2');
    h.session.move(100, 225); // t2 bottom quarter → after t2
    h.tick();
    expect(h.session.target()).toMatchObject({ parentId: 's1', slot: 'default', index: 1 });
    expect(h.layer.querySelector<HTMLElement>('.bldr-drop-indicator')?.style.visibility).toBe(
      'visible',
    );

    h.session.release();
    expect(h.kernel.transactions()).toHaveLength(1);
    expect(h.kernel.getDocument().nodes['s1']?.slots?.['default']).toEqual(['t2', 't1']);
    expect(h.kernel.context.store.getState().selection).toEqual(['t1']); // follows the node
    expect(h.announcements.at(-1)).toContain('Moved');
    expect(h.suppressions).toEqual([true, false]); // hover restored
  });

  it('s3: a same-position drop dispatches NOTHING', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(90, 90);
    h.setHovered('t1');
    h.session.move(100, 30); // t1 top quarter → before itself = same position
    h.tick();
    h.session.release();
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.announcements.at(-1)).toBe('Kept in place');
  });

  it('announces a moved block by display name rather than catalogue prose', () => {
    const h = setup();
    expect(TEXT_DESCRIPTION).toContain('.');

    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(90, 90);
    const ghostLabel = h.layer.querySelector('.bldr-drag-ghost')?.textContent;

    h.setHovered('t2');
    h.session.move(100, 225);
    h.tick();
    h.session.release();

    const announcement = h.announcements.at(-1);
    expect(announcement).toBe('Moved Text');
    expect(announcement).not.toContain(TEXT_DESCRIPTION);
    expect(announcement).not.toContain('.');
    expect(ghostLabel).toBe('Text');
  });

  it('s4: cancel is zero-trace — document reference-identical, chrome gone', () => {
    const h = setup();
    const before = h.kernel.getDocument();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(120, 120);
    h.setHovered('t2');
    h.session.move(100, 150);
    h.tick();
    h.session.cancel(); // Escape path
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.layer.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe('hidden');
    expect(h.announcements.at(-1)).toBe('Drag cancelled');
  });

  it('s4: release with no valid target cancels with zero trace', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 's1' }, 60, 60, 'handle');
    h.session.move(120, 120);
    h.setHovered('t1'); // a SECTION over a text: t1's gap rejects sections…
    // …and every ancestor (s1 = self, root) is excluded or full — force null by
    // hovering inside s1's own subtree where the only acceptor is root, which
    // accepts sections; so use s2's middle instead? Simplest hard-null: hover
    // nothing and make the root reject by dragging the root's only allowed kind
    // into a leaf-only zone is impossible here — so assert the WEAKER truth:
    // release over t1 top-quarter resolves to root (valid) — covered elsewhere.
    // For a guaranteed null, drag t1 over NOTHING with an empty-slot root that
    // does not accept text:
    h.setHovered(undefined);
    h.session.move(200, 590); // empty canvas → root.default allows only sections
    h.tick();
    // payload is s1 (a section) → root accepts ⇒ valid. Re-press with a text:
    h.session.cancel();
    const before = h.kernel.getDocument();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(120, 120);
    h.setHovered(undefined);
    h.session.move(200, 590); // root.default rejects text ⇒ no target anywhere
    h.tick();
    expect(h.session.target()).toBeNull();
    h.session.release();
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.announcements.at(-1)).toBe('No valid target');
  });

  it('s4b: a PENDING gesture self-cancels silently — nothing started, so nothing was cancelled', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    expect(h.session.phase()).toBe('pending'); // pressed, never moved
    const announcementsBefore = h.announcements.length;

    h.kernel.dispatch('removeNode', { id: 't1' });

    // The self-cancel law is unchanged: the session still resets.
    expect(h.session.phase()).toBe('idle');
    // But it says nothing. Measured on a fresh page before this gate existed:
    // one ordinary click to select a block announced "Drag cancelled", so a
    // screen-reader user was told a drag had been cancelled every time they
    // chose a block.
    expect(h.announcements).toHaveLength(announcementsBefore);
  });

  it('s4: a move payload whose node disappears mid-drag self-cancels', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(120, 120);
    expect(h.session.phase()).toBe('active');
    h.kernel.dispatch('removeNode', { id: 't1' }); // another surface removes it
    expect(h.session.phase()).toBe('idle');
    expect(h.announcements.at(-1)).toBe('Drag cancelled');
  });

  it('insert payloads dispatch ONE insertNode and select the new node', () => {
    const h = setup();
    h.session.press({ kind: 'insert', type: 'section' }, 30, 30, 'handle');
    h.session.move(80, 80);
    h.setHovered(undefined);
    h.session.move(200, 590); // empty canvas → into root, index 2
    h.tick();
    expect(h.session.target()).toMatchObject({ parentId: 'root', index: 3 });
    h.session.release();
    expect(h.kernel.transactions()).toHaveLength(1);
    const children = h.kernel.getDocument().nodes['root']?.slots?.['default'];
    expect(children).toHaveLength(4);
    const inserted = children?.[3];
    expect(h.kernel.getDocument().nodes[inserted ?? '']?.type).toBe('section');
    expect(h.kernel.context.store.getState().selection).toEqual([inserted]);
    expect(h.announcements.at(-1)).toBe('Inserted Section');
  });

  it('release resolves against the LATEST pointer position, not a stale flush', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(90, 90);
    h.setHovered('t2');
    h.session.move(100, 225); // after t2 — but NO tick: flush never ran
    h.session.release(); // release must flush before committing
    expect(h.kernel.getDocument().nodes['s1']?.slots?.['default']).toEqual(['t2', 't1']);
  });

  it('s6: OUTSIDE the preview viewport there is no target — ever (review Critical #1)', () => {
    // "Empty area inside the canvas" targets the root; "the pointer left the
    // canvas entirely" must NOT — a palette drag that never reached the canvas
    // would otherwise commit a phantom root append on release.
    const h = setup();
    const before = h.kernel.getDocument();
    h.session.press({ kind: 'insert', type: 'section' }, -60, 30, 'handle');
    h.session.move(-40, 60); // crosses the threshold, still over the palette
    h.setHovered(undefined);
    h.session.move(-20, 300); // negative x: outside [0, width)
    h.tick();
    expect(h.session.target()).toBeNull();
    expect(h.layer.querySelector<HTMLElement>('.bldr-drop-indicator')?.style.visibility).not.toBe(
      'visible',
    );

    h.session.move(200, 700); // below the viewport: outside [0, height)
    h.tick();
    expect(h.session.target()).toBeNull();

    h.session.release();
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.announcements.at(-1)).toBe('No valid target');
  });

  it('US1/AC4 end-to-end: a FULL slot is skipped by resolution; own-slot reorder still offered', () => {
    // hero.actions has max 2 and holds b1, b2 — an OUTSIDE button dragged over
    // it must be offered hero1's sibling gap instead (the resolver climbs);
    // b1 reordering within its own full slot keeps its seat.
    const h = setup();
    h.session.press({ kind: 'insert', type: 'button' }, 60, 60, 'handle');
    h.session.move(90, 90);
    h.setHovered('hero1');
    h.session.move(100, 320); // hero1's middle band — its only slot is FULL (max 2)
    h.tick();
    expect(h.session.target()?.parentId).not.toBe('hero1'); // skipped, not offered
    h.session.cancel();

    // Own-slot exemption end-to-end: b1 dragged within actions IS offered.
    h.session.press({ kind: 'move', id: 'b1' }, 25, 285, 'handle');
    h.session.move(60, 300);
    h.setHovered('b2');
    h.session.move(150, 285); // b2's top quarter → before b2 (same full slot)
    h.tick();
    expect(h.session.target()).toMatchObject({ parentId: 'hero1', slot: 'actions' });
    h.session.cancel();
  });

  it('dispose removes chrome and deafens inputs', () => {
    const h = setup();
    h.session.dispose();
    expect(h.layer.children).toHaveLength(0);
    h.session.press({ kind: 'move', id: 't1' }, 10, 10, 'handle');
    expect(h.session.phase()).toBe('idle');
  });
});

describe('convergence regressions (006 audit)', () => {
  it('FR-001: a move payload removed while PENDING self-cancels — no ghost ever', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 50, 50, 'handle');
    expect(h.session.phase()).toBe('pending');
    h.kernel.dispatch('removeNode', { id: 't1' }); // vanishes before activation
    expect(h.session.phase()).toBe('idle'); // self-cancelled, not lingering
    h.kernel.undo();

    // And the activation guard itself: pending survives an UNRELATED change,
    // then a threshold-crossing move for a since-removed node cancels cleanly.
    h.session.press({ kind: 'move', id: 't2' }, 50, 50, 'handle');
    h.kernel.dispatch('removeNode', { id: 't2' });
    h.session.move(120, 120); // would activate — must cancel instead
    expect(h.session.phase()).toBe('idle');
    expect(h.layer.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).not.toBe(
      'visible',
    );
  });

  it('a geometry invalidation mid-drag re-resolves the indicator with ZERO pointer movement', () => {
    const h = setup();
    h.session.press({ kind: 'move', id: 't1' }, 60, 60, 'handle');
    h.session.move(90, 90);
    h.setHovered('t2');
    h.session.move(100, 225);
    h.tick();
    const indicator = h.layer.querySelector<HTMLElement>('.bldr-drop-indicator');
    const before = indicator?.style.transform;

    // Layout moved (a dir flip reflow): the index notifies, the pointer is still.
    RECTS['t2'] = { nodeId: 't2', x: 220, y: 130, width: 160, height: 100, version: 1 };
    h.invalidate();
    h.tick();
    expect(indicator?.style.transform).not.toBe(before); // re-tracked, no move()
    RECTS['t2'] = { nodeId: 't2', x: 20, y: 130, width: 360, height: 100, version: 0 };
    h.session.cancel();
  });
});
