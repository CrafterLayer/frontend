import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { Palette } from './Palette';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, label: string, slots?: Record<string, { allow: string[] }>) => ({
  schema: defineBlockSchema({
    type,
    description: label,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'palette-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'Page', { default: { allow: ['section'] } }),
      block('section', 'Section', { default: { allow: ['text'] } }),
      block('text', 'Text'),
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1'] } },
    s1: { id: 's1', type: 'section', props: {}, slots: { default: ['t1'] } },
    t1: { id: 't1', type: 'text', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pl') },
  });

describe('Palette (006 contract §4)', () => {
  it('p1: lists the registered vocabulary with display names, live under runtime changes', () => {
    const kernel = makeKernel();
    render(<Palette kernel={kernel} />);
    expect(screen.getByRole('button', { name: 'Page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument();

    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'late',
        version: '1.0.0',
        contributes: { blocks: [block('banner', 'Banner')] },
      });
    });
    expect(screen.getByRole('button', { name: 'Banner' })).toBeInTheDocument();

    act(() => {
      kernel.extensions.dispose('late');
    });
    expect(screen.queryByRole('button', { name: 'Banner' })).not.toBeInTheDocument();
  });

  it('p2: keyboard activation inserts AFTER the selected node when its slot accepts', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['t1']);
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.click(screen.getByRole('button', { name: 'Text' }));
    const children = kernel.getDocument().nodes['s1']?.slots?.['default'];
    expect(children).toHaveLength(2);
    expect(children?.[0]).toBe('t1'); // inserted AFTER the selection
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.context.store.getState().selection).toEqual([children?.[1]]);
    expect(screen.getByRole('status', { name: 'Palette' })).toHaveTextContent('Inserted text');
  });

  it('p2: falls back to the walk-up rule when the sibling slot rejects the type', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['t1']); // t1's slot accepts only text — a SECTION must walk up
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.click(screen.getByRole('button', { name: 'Section' }));
    // s1.default rejects sections too, so it lands appended in root.default.
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(2);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('p2: announces and dispatches nothing when no slot accepts the type', async () => {
    const kernel = makeKernel();
    // A vocabulary entry nothing in this document can host:
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'orphan',
        version: '1.0.0',
        contributes: { blocks: [block('widget', 'Widget')] },
      });
    });
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Widget' }));
    expect(kernel.transactions()).toHaveLength(0);
    expect(screen.getByRole('status', { name: 'Palette' })).toHaveTextContent(
      'No slot accepts widget here',
    );
  });

  it('p3: pointerdown hands the payload to the canvas drag handle', () => {
    const kernel = makeKernel();
    const beginInsert = vi.fn();
    render(<Palette kernel={kernel} dragHandle={{ beginInsert }} />);
    const entry = screen.getByRole('button', { name: 'Section' });
    entry.dispatchEvent(new MouseEvent('pointerdown', { clientX: 40, clientY: 50, bubbles: true }));
    expect(beginInsert).toHaveBeenCalledWith('section', 40, 50);
    expect(kernel.transactions()).toHaveLength(0); // the palette dispatched nothing
  });
});

describe('convergence: an aborted drag never becomes a click-insert (US2/AC5)', () => {
  it('suppresses the entry click when the press turned into a REAL drag', async () => {
    const kernel = makeKernel();
    let activated = false;
    render(
      <Palette
        kernel={kernel}
        dragHandle={{
          beginInsert: () => ({ didActivate: () => activated }),
        }}
      />,
    );
    const user = userEvent.setup();
    const entry = screen.getByRole('button', { name: 'Section' });

    // Gesture 1: press → the session ACTIVATED (threshold crossed) → the drag
    // was cancelled elsewhere → the trailing click must insert NOTHING.
    entry.dispatchEvent(new MouseEvent('pointerdown', { clientX: 4, clientY: 5, bubbles: true }));
    activated = true;
    await user.click(entry);
    expect(kernel.transactions()).toHaveLength(0);

    // Gesture 2: a plain click (no activation) still inserts normally.
    entry.dispatchEvent(new MouseEvent('pointerdown', { clientX: 4, clientY: 5, bubbles: true }));
    activated = false;
    await user.click(entry);
    expect(kernel.transactions()).toHaveLength(1);
  });
});
