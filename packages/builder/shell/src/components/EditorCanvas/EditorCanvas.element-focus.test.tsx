import { act, fireEvent, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { CustomCode, lightTheme } from '@craftkit/builder-renderer';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { EditorCanvas } from './EditorCanvas';

const PassThrough: BlockRenderComponent = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;

/** The real composition renderer, so the canvas sees the real element addresses. */
const RegionRender = ((props: BlockRenderProps<{ tree: unknown }>) => (
  <CustomCode tree={props.props.tree} hostId={props.node.id} isCanvas={props.isCanvas} />
)) as unknown as BlockRenderComponent;

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'canvas-element-focus-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'section'] } },
          examples: [],
        }),
        render: PassThrough,
      },
      {
        schema: defineBlockSchema({
          type: 'section',
          description: 'Section',
          props: z.object({}),
          examples: [],
        }),
        render: PassThrough,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({
            label: z.string().default(''),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          examples: [],
        }),
        render: RegionRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 's1'] } },
    r1: {
      id: 'r1',
      type: 'region',
      props: {
        label: 'CV header',
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [
                { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'Portrait' } },
                { kind: 'element', tag: 'h1', text: 'Reem Haddad' },
                { kind: 'element', tag: 'button', text: 'Hire me' },
              ],
            },
          ],
        },
      },
    },
    s1: { id: 's1', type: 'section', props: {} },
  },
};

function harness() {
  const kernel = createBuilder({
    document: DOC,
    extensions: [BLOCKS],
    ports: { clock: fixedClock(), ids: seededIds('ef') },
  });
  const queue: (() => void)[] = [];
  let hitTarget: Element | null = null;
  const ports: Partial<GeometryPorts> = {
    measure: () => ({ x: 5, y: 6, width: 50, height: 20 }),
    hitTest: () => hitTarget,
    viewport: () => ({ width: 400, height: 600 }),
    schedule: (callback) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) queue.splice(at, 1);
      };
    },
  };
  const view = render(<EditorCanvas kernel={kernel} theme={lightTheme} geometryPorts={ports} />);
  const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) throw new Error('frame must expose a document in jsdom');
  const tick = () => {
    act(() => {
      for (const callback of queue.splice(0)) callback();
    });
  };
  const inFrame = (selector: string) => frameDocument.querySelector<HTMLElement>(selector);
  const click = (target: Element | null) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1 }));
    });
  };
  const pointerMove = (target: Element | null) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: 1, clientY: 1 }));
    });
  };
  const outline = (kind: 'hover' | 'selection') =>
    view.container.querySelector<HTMLElement>(`.bldr-outline--${kind}`);
  const state = () => kernel.context.store.getState();
  return { kernel, frameDocument, tick, inFrame, click, pointerMove, outline, state };
}

describe('EditorCanvas — element focus inside a composed region', () => {
  it('clicking an authored image selects the region AND focuses the image, named on the chip', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('img'));
    h.tick();
    expect(h.state().selection).toEqual(['r1']);
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0, 0] });
    expect(h.outline('selection')?.style.visibility).toBe('visible');
    expect(h.outline('selection')?.textContent).toBe('Image');
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Image in CV header selected',
    );
  });

  it('text and buttons are addressed the same way — it is every authored element, not just images', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h1'));
    h.tick();
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0, 1] });
    expect(h.outline('selection')?.textContent).toBe('Heading');
    h.click(h.inFrame('button'));
    h.tick();
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0, 2] });
    expect(h.outline('selection')?.textContent).toBe('Button');
  });

  it('hover names the element under the pointer; an ordinary block hovers as before', () => {
    const h = harness();
    h.tick();
    h.pointerMove(h.inFrame('img'));
    h.tick();
    expect(h.outline('hover')?.textContent).toBe('Image');
    h.pointerMove(h.inFrame('[data-bldr-node="s1"]'));
    h.tick();
    expect(h.outline('hover')?.textContent).toBe('Section');
  });

  it('Escape steps out to the region, then its parent, then clears the selection', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('img'));
    h.tick();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    fireEvent.keyDown(host, { key: 'Escape' });
    h.tick();
    expect(h.state().selection).toEqual(['r1']);
    expect(h.state().elementFocus).toBeNull();
    expect(h.outline('selection')?.textContent).toBe('CV header');
    fireEvent.keyDown(host, { key: 'Escape' });
    expect(h.state().selection).toEqual(['root']);
    fireEvent.keyDown(host, { key: 'Escape' });
    expect(h.state().selection).toEqual([]);
  });

  it('clicking the region outside any authored element, or an ordinary block, is a whole-node selection', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('img'));
    h.click(h.inFrame('[data-bldr-node="r1"]'));
    expect(h.state().selection).toEqual(['r1']);
    expect(h.state().elementFocus).toBeNull();
    h.click(h.inFrame('[data-bldr-node="s1"]'));
    expect(h.state().selection).toEqual(['s1']);
    expect(h.state().elementFocus).toBeNull();
    h.click(null);
    expect(h.state().selection).toEqual([]);
  });
});
