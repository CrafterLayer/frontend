import { act, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  forwardedPartProps,
  partStylesProp,
  type BlockRenderComponent,
  type BlockRenderProps,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { IN_PLACE_TEXT_CLASS } from '../../overlay/in-place-text-edit';
import { permissiveUtilityOracle } from '../../overlay/tree-test-kit';
import type { GeometryPorts } from '../../rects';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { EditorCanvas } from './EditorCanvas';
import { EDITOR_CANVAS_LABELS_AR } from './EditorCanvas.labels';

/*
  Typing in place on a part a PARENT draws (block-parts gap: tab triggers).
  `strip` draws each child `tab`'s `label` part as a button the way Tabs draws
  its triggers; the tab's own render never shows that text.
*/

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

const tabSchema = defineBlockSchema({
  type: 'tab',
  description: 'One tab',
  props: z.object({ label: z.string().min(1).max(40), partStyles: partStylesProp() }),
  parts: { label: { kind: 'text', bind: 'label', label: { en: 'Tab label', ar: 'تسمية التبويب' } } },
  examples: [],
});

const StripRender = ((render: BlockRenderProps<Record<string, never>> & { slots: Record<string, unknown> }) => {
  const children = render.slotChildren?.['default'] ?? [];
  return (
    <div>
      <div role="tablist">
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            role="tab"
            {...forwardedPartProps(
              { node: { id: child.id, type: 'tab', props: {} }, props: child.props, isCanvas: render.isCanvas },
              tabSchema.parts,
              'label',
            )}
          >
            {String(child.props['label'])}
          </button>
        ))}
      </div>
      {render.slots['default']}
    </div>
  );
}) as unknown as BlockRenderComponent;

const TabRender = (() => <div className="panel">Panel body</div>) as unknown as BlockRenderComponent;
const PageRender = ((render: { slots: Record<string, unknown> }) => (
  <main>{render.slots['default'] as React.ReactNode}</main>
)) as unknown as BlockRenderComponent;

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'forwarded-part-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['strip'] } },
          examples: [],
        }),
        render: PageRender,
      },
      {
        schema: defineBlockSchema({
          type: 'strip',
          description: 'A tab strip',
          props: z.object({}),
          slots: { default: { allow: ['tab'], exposeChildMetadata: true } },
          examples: [],
        }),
        render: StripRender,
      },
      { schema: tabSchema, render: TabRender },
    ],
  },
};

function harness(arabic = false) {
  const kernel = createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: arabic ? 'rtl' : 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['strip'] } },
        strip: { id: 'strip', type: 'strip', props: {}, slots: { default: ['tab-a', 'tab-b'] } },
        'tab-a': { id: 'tab-a', type: 'tab', props: { label: arabic ? 'نظرة عامة' : 'Overview', partStyles: {} } },
        'tab-b': { id: 'tab-b', type: 'tab', props: { label: 'Details', partStyles: {} } },
      },
    },
    extensions: [BLOCKS],
    ports: { clock: fixedClock(), ids: seededIds('forwarded') },
  });
  const queue: (() => void)[] = [];
  let hitTarget: Element | null = null;
  const ports: Partial<GeometryPorts> = {
    measure: () => ({ x: 5, y: 60, width: 200, height: 40 }),
    hitTest: () => hitTarget,
    viewport: () => ({ width: 800, height: 600 }),
    schedule: (callback) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) queue.splice(at, 1);
      };
    },
  };
  render(
    <EditorCanvas
      kernel={kernel}
      theme={lightTheme}
      geometryPorts={ports}
      floatingPorts={{ measure: () => ({ width: 160, height: 32 }), observe: () => () => undefined }}
      editable
      {...(arabic ? { canvasLabels: EDITOR_CANVAS_LABELS_AR, editorDir: 'rtl' as const } : {})}
    />,
  );
  const frameDocument = screen.getByTitle<HTMLIFrameElement>('Editor canvas').contentDocument!;
  const tick = () => {
    act(() => {
      for (const callback of queue.splice(0)) callback();
    });
  };
  const trigger = (id: string) =>
    frameDocument.querySelector<HTMLElement>(`[data-ck-part="label"][data-ck-part-owner="${id}"]`);
  const doubleClick = (target: Element | null) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX: 1, clientY: 1 }));
    });
    tick();
  };
  const surface = () => frameDocument.querySelector<HTMLElement>(`.${IN_PLACE_TEXT_CLASS}`);
  const press = (key: string, init: KeyboardEventInit = {}) => {
    act(() => {
      surface()?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    });
  };
  const label = (id: string) => kernel.getDocument().nodes[id]?.props['label'];
  return { kernel, frameDocument, tick, trigger, doubleClick, surface, press, label };
}

describe('EditorCanvas — typing in place on a forwarded part (tab triggers)', () => {
  it('a double-click on the trigger types in place; Enter is ONE transaction and ONE Undo', () => {
    const h = harness();
    h.tick();
    const trigger = h.trigger('tab-a');
    expect(trigger).not.toBeNull();
    h.doubleClick(trigger);
    const surface = h.surface();
    expect(surface).not.toBeNull();
    expect(trigger?.contains(surface)).toBe(true);
    expect(surface).toHaveAttribute('role', 'textbox');
    expect(surface).toHaveAttribute('aria-label', 'Tab label');
    expect(surface).toHaveTextContent('Overview');
    expect(surface?.ownerDocument.activeElement).toBe(surface);

    const before = h.kernel.transactions().length;
    act(() => {
      surface!.textContent = 'Summary';
    });
    h.press('Enter');
    expect(h.kernel.transactions().length).toBe(before + 1);
    expect(h.label('tab-a')).toBe('Summary');
    expect(h.label('tab-b')).toBe('Details');
    // React's own text is back in the trigger, now showing the new label.
    expect(h.surface()).toBeNull();
    expect(h.trigger('tab-a')).toHaveTextContent('Summary');

    act(() => {
      h.kernel.undo();
    });
    expect(h.label('tab-a')).toBe('Overview');
    expect(h.trigger('tab-a')).toHaveTextContent('Overview');
  });

  it('Escape cancels with no trace; an unchanged commit writes nothing', () => {
    const h = harness();
    h.tick();
    const before = h.kernel.transactions().length;
    h.doubleClick(h.trigger('tab-b'));
    act(() => {
      h.surface()!.textContent = 'Typed then abandoned';
    });
    h.press('Escape');
    expect(h.surface()).toBeNull();
    expect(h.label('tab-b')).toBe('Details');
    expect(h.trigger('tab-b')).toHaveTextContent('Details');

    h.doubleClick(h.trigger('tab-b'));
    h.press('Enter');
    expect(h.kernel.transactions().length).toBe(before);
  });

  it('blur commits, and a refused value is announced while the stored text shows again', () => {
    const h = harness();
    h.tick();
    h.doubleClick(h.trigger('tab-a'));
    act(() => {
      h.surface()!.textContent = 'Pricing';
      h.surface()!.blur();
    });
    expect(h.label('tab-a')).toBe('Pricing');

    // The schema refuses an empty label (min 1): nothing is written.
    h.doubleClick(h.trigger('tab-a'));
    const before = h.kernel.transactions().length;
    act(() => {
      h.surface()!.textContent = '';
    });
    h.press('Enter');
    expect(h.kernel.transactions().length).toBe(before);
    expect(h.label('tab-a')).toBe('Pricing');
    expect(h.trigger('tab-a')).toHaveTextContent('Pricing');
  });

  it('Arabic: the surface is named in Arabic and follows its own text direction', () => {
    const h = harness(true);
    h.tick();
    h.doubleClick(h.trigger('tab-a'));
    const surface = h.surface();
    expect(surface).toHaveAttribute('aria-label', 'تسمية التبويب');
    expect(surface).toHaveAttribute('dir', 'auto');
    act(() => {
      surface!.textContent = 'الأسعار';
    });
    h.press('Enter');
    expect(h.label('tab-a')).toBe('الأسعار');
  });
});
