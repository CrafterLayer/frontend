import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { ELEMENT_NAME_WORDS_AR } from '../../custom-code/element-target';
import type { GeometryPorts } from '../../rects';
import { EditorCanvas, type EditorCanvasProps } from './EditorCanvas';
import { EDITOR_CANVAS_LABELS_AR } from './EditorCanvas.labels';

/*
  arabic-editor: the canvas chips and announcements speak the editor's
  language, and a new screen size keeps the selection IN VIEW — the final
  test found the picked element thousands of pixels below the fold at mobile,
  its outline and quick bar hidden, which read as a lost selection.
*/

const PassThrough: BlockRenderComponent = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;

const RegionRender = ((props: BlockRenderProps<{ tree: unknown }>) => (
  <CustomCode tree={props.props.tree} hostId={props.node.id} isCanvas={props.isCanvas} />
)) as unknown as BlockRenderComponent;

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'canvas-arabic-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'card'] } },
          examples: [],
        }),
        render: PassThrough,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
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
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'c1'] } },
    r1: {
      id: 'r1',
      type: 'region',
      props: {
        label: 'رأس الصفحة',
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [{ kind: 'element', tag: 'h1', text: 'مرحبًا' }],
            },
          ],
        },
      },
    },
    c1: { id: 'c1', type: 'card', props: {} },
  },
};

function harness(props: Partial<EditorCanvasProps> = {}) {
  const kernel = createBuilder({
    document: DOC,
    extensions: [BLOCKS],
    ports: { clock: fixedClock(), ids: seededIds('car') },
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
  const arabic = {
    elementNameWords: ELEMENT_NAME_WORDS_AR,
    canvasLabels: EDITOR_CANVAS_LABELS_AR,
    editorDir: 'rtl' as const,
  };
  const view = render(
    <EditorCanvas kernel={kernel} theme={lightTheme} geometryPorts={ports} {...arabic} {...props} />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) throw new Error('frame must expose a document in jsdom');
  const tick = () => {
    act(() => {
      for (const callback of queue.splice(0)) callback();
    });
  };
  const click = (target: Element | null) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1 }));
    });
  };
  const rerender = (next: Partial<EditorCanvasProps>) => {
    view.rerender(
      <EditorCanvas kernel={kernel} theme={lightTheme} geometryPorts={ports} {...arabic} {...next} />,
    );
  };
  const outline = () => view.container.querySelector<HTMLElement>('.bldr-outline--selection');
  return { kernel, frameDocument, tick, click, rerender, outline };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditorCanvas in the Arabic editor', () => {
  it('names the chip and the selection announcement in Arabic', () => {
    const h = harness();
    h.tick();
    h.click(h.frameDocument.querySelector('h1'));
    h.tick();
    expect(h.outline()?.textContent).toBe('عنوان');
    expect(screen.getByRole('status', { name: 'التحديد' })).toHaveTextContent('حُدِّد عنوان في رأس الصفحة');

    act(() => {
      h.kernel.setSelection(['c1']);
    });
    h.tick();
    // A registered block is named from the Arabic catalogue, not as "Card".
    expect(h.outline()?.textContent).toBe('بطاقة');
  });

  it('keeps the selection and scrolls it into view when the screen size changes', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const h = harness({ frameWidth: 1280, breakpoint: 'desktop' });
    h.tick();
    h.click(h.frameDocument.querySelector('h1'));
    h.tick();
    const heading = h.frameDocument.querySelector('h1');
    const scrolled = vi.fn();
    const proto = (h.frameDocument.defaultView ?? window).HTMLElement.prototype;
    Object.defineProperty(proto, 'scrollIntoView', { value: scrolled, configurable: true, writable: true });

    act(() => {
      h.rerender({ frameWidth: 390, breakpoint: 'mobile' });
    });

    expect(h.kernel.context.store.getState().elementFocus).toEqual({ id: 'r1', path: [0, 0] });
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    expect(scrolled.mock.contexts.at(-1)).toBe(h.frameDocument.querySelector('h1') ?? heading);
    Reflect.deleteProperty(proto, 'scrollIntoView');
  });
});

describe('EditorCanvas zoom box in an Arabic (RTL) editor (fix pass 2026-10-06)', () => {
  /*
    jsdom has no layout, so this guards the rule the Chromium measurement
    proved: at Fit zoom (912/1280) in an RTL editor, `inset-inline-start`
    put the frame at x -280..632 inside a 88..1000 viewport (page start cut
    off, empty strip on the end side, scrollWidth 1280); the physical
    top-left anchor puts it at 88..1000 exactly, scrollWidth 912. The scale
    grows from `transform-origin: top left`, so the box must sit at the left.
  */
  const css = readFileSync(
    join(process.cwd(), 'src', 'components', 'EditorCanvas', 'EditorCanvas.css'),
    'utf8',
  );
  const rule = /\.bldr-canvas-frame-shell \{([^}]*)\}/u.exec(css)?.[1] ?? '';

  it('anchors the scaled frame at the same physical corner it scales from', () => {
    expect(rule).toMatch(/transform-origin: top left;/u);
    expect(rule).toMatch(/(^|\s)left: 0;/u);
    expect(rule).toMatch(/(^|\s)top: 0;/u);
    expect(rule).not.toMatch(/inset-inline-start/u);
  });
});

