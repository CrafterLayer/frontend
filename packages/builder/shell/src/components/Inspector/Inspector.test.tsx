import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { DocumentView } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { Inspector } from './Inspector';

const CardRender = ((props: BlockRenderProps<{ title: string }>) => (
  <article data-testid={`card-${props.node.id}`}>{props.props.title}</article>
)) as unknown as BlockRenderComponent;
const SlotRender = ((props: BlockRenderProps) => (
  <div>{props.slots['default']}</div>
)) as unknown as BlockRenderComponent;
const NullRender: BlockRenderComponent = () => null;

const CARD_PROPS = z.object({
  title: z.string().max(10).default('Hi'),
  tone: z.enum(['light', 'dark']).default('light'),
  featured: z.boolean().default(false),
  count: z.number().default(1),
  slug: z.string().min(1).max(10).default('x'),
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inspector-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['card', 'plain', 'exotic'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
          props: CARD_PROPS,
          examples: [],
        }),
        render: CardRender,
      },
      {
        schema: defineBlockSchema({
          type: 'plain',
          description: 'Plain',
          props: z.object({}),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'exotic',
          description: 'Exotic',
          props: z.object({ meta: z.array(z.string()).default([]) }),
          examples: [],
        }),
        render: NullRender,
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
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1', 'pl1', 'ex1'] } },
    c1: {
      id: 'c1',
      type: 'card',
      props: { title: 'Hello', tone: 'light', featured: false, count: 3, slug: 'Go' },
    },
    pl1: { id: 'pl1', type: 'plain', props: {} },
    ex1: { id: 'ex1', type: 'exotic', props: { meta: ['a', 'b'] } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('insp') },
  });

const txCount = (kernel: BuilderKernel) => kernel.transactions().length;

describe('US1 — generated inspector (007 contract §4)', () => {
  it('AC1: renders the four kinds as matching controls with labels and current values', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);

    expect(screen.getByRole('heading', { name: 'Card' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    expect(screen.getByRole('combobox', { name: 'tone' })).toHaveValue('light');
    expect(screen.getByRole('switch', { name: 'featured' })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'count' })).toHaveValue(3);
  });

  it('AC2: each committed change is exactly one transaction and the canvas is live', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(
      <>
        <Inspector kernel={kernel} />
        <DocumentView kernel={kernel} />
      </>,
    );
    expect(screen.getByTestId('card-c1')).toHaveTextContent('Hello');

    const before = txCount(kernel);
    await user.type(screen.getByRole('textbox', { name: 'title' }), '!');
    expect(txCount(kernel)).toBe(before + 1); // one commit, one transaction
    expect(screen.getByTestId('card-c1')).toHaveTextContent('Hello!');
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello!');

    await user.selectOptions(screen.getByRole('combobox', { name: 'tone' }), 'dark');
    await user.click(screen.getByRole('switch', { name: 'featured' }));
    expect(txCount(kernel)).toBe(before + 3);
    const node = kernel.getDocument().nodes['c1'];
    expect(node?.props['tone']).toBe('dark');
    expect(node?.props['featured']).toBe(true);
  });

  it('AC3: a door rejection changes nothing and surfaces control-adjacent via aria-describedby', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const input = screen.getByRole('textbox', { name: 'title' });
    await user.clear(input); // '' is valid (max 10) — baseline commit
    const before = txCount(kernel);
    const docBefore = kernel.getDocument();

    await user.paste('12345678901'); // 11 chars > max(10) — rejected at the door
    expect(txCount(kernel)).toBe(before);
    expect(kernel.getDocument()).toBe(docBefore); // reference-identical: zero change
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const reason = document.getElementById(describedBy ?? '');
    expect(reason).not.toBeNull();
    expect(reason?.textContent).not.toHaveLength(0);
  });

  it('AC4: no selection shows the accessible empty state', () => {
    const kernel = makeKernel();
    render(<Inspector kernel={kernel} />);
    expect(
      within(screen.getByRole('region', { name: 'Inspector' })).getByText(
        'Select a block to edit its properties.',
      ),
    ).toBeInTheDocument();
  });

  it('AC5: document truth — undo restores the control value; pruning empties the panel', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    await user.type(screen.getByRole('textbox', { name: 'title' }), 'X');
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('HelloX');
    act(() => {
      kernel.undo();
    });
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');

    // Pruned selection (B2a law): removing the inspected node empties the panel.
    act(() => {
      kernel.dispatch('removeNode', { id: 'c1' }, 'user');
    });
    expect(screen.getByText('Select a block to edit its properties.')).toBeInTheDocument();
  });

  it('states the no-editable-properties case and falls back to read-only for exotic schemas', () => {
    const kernel = makeKernel();
    kernel.setSelection(['pl1']);
    const { rerender } = render(<Inspector kernel={kernel} />);
    expect(screen.getByText('This block has no editable properties.')).toBeInTheDocument();

    kernel.setSelection(['ex1']);
    rerender(<Inspector kernel={kernel} />);
    const readonly = screen.getByRole('textbox', { name: 'meta' });
    expect(readonly).toHaveValue('["a","b"]');
    expect(readonly).toHaveAttribute('readonly');
  });

  it('US2 AC1/AC2: an override bucket labels itself, writes setResponsive, and renders per breakpoint', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(
      <>
        <Inspector kernel={kernel} bucket="tablet" />
        <div data-testid="at-tablet">
          <DocumentView kernel={kernel} breakpoint="tablet" />
        </div>
        <div data-testid="at-desktop">
          <DocumentView kernel={kernel} breakpoint="desktop" />
        </div>
      </>,
    );
    expect(screen.getByText('Editing tablet overrides')).toBeInTheDocument();

    // No override yet: the text control is EMPTY with the base as placeholder.
    const input = screen.getByRole('textbox', { name: 'title' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Hello');
    expect(screen.queryByText('tablet override')).not.toBeInTheDocument();

    const before = txCount(kernel);
    await user.type(input, 'Tab'); // three commits — three override transactions
    expect(txCount(kernel)).toBe(before + 3);

    const node = kernel.getDocument().nodes['c1'];
    expect(node?.props['title']).toBe('Hello'); // base untouched
    expect(node?.responsive?.tablet?.['title']).toBe('Tab');
    expect(screen.getByText('tablet override')).toBeInTheDocument();
    expect(within(screen.getByTestId('at-tablet')).getByTestId('card-c1')).toHaveTextContent('Tab');
    expect(within(screen.getByTestId('at-desktop')).getByTestId('card-c1')).toHaveTextContent(
      'Hello',
    );
  });

  it('US2 AC3: clearing an override is ONE transaction and restores the inherited base', async () => {
    const kernel = makeKernel();
    act(() => {
      kernel.dispatch(
        'setResponsive',
        { id: 'c1', breakpoint: 'tablet', key: 'title', value: 'Tablet!' },
        'user',
      );
    });
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} bucket="tablet" />);

    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Tablet!');
    const before = txCount(kernel);
    await user.click(screen.getByRole('button', { name: 'Clear title override' }));
    expect(txCount(kernel)).toBe(before + 1);
    expect(kernel.getDocument().nodes['c1']?.responsive?.tablet).toBeUndefined();
    const input = screen.getByRole('textbox', { name: 'title' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Hello'); // inherited base shows through
    expect(screen.queryByText('tablet override')).not.toBeInTheDocument();
  });

  it('US2 AC5: undo/redo across responsive edits keeps inspector and canvas in lockstep', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(
      <>
        <Inspector kernel={kernel} bucket="tablet" />
        <DocumentView kernel={kernel} breakpoint="tablet" />
      </>,
    );
    await user.type(screen.getByRole('textbox', { name: 'title' }), 'T');
    expect(screen.getByTestId('card-c1')).toHaveTextContent('T');
    expect(screen.getByText('tablet override')).toBeInTheDocument();

    act(() => {
      kernel.undo();
    });
    expect(screen.getByTestId('card-c1')).toHaveTextContent('Hello'); // base again
    expect(screen.queryByText('tablet override')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('');

    act(() => {
      kernel.redo();
    });
    expect(screen.getByTestId('card-c1')).toHaveTextContent('T');
    expect(screen.getByText('tablet override')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('T');
  });

  it('US2 edge: an override equal to the base is STILL an override (explicit intent)', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} bucket="mobile" />);
    const input = screen.getByRole('textbox', { name: 'title' });
    await user.click(input);
    await user.paste('Hello'); // identical to the base value
    expect(kernel.getDocument().nodes['c1']?.responsive?.mobile?.['title']).toBe('Hello');
    expect(screen.getByText('mobile override')).toBeInTheDocument();
  });

  it('announces commits and rejections through the named polite region', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    await user.type(screen.getByRole('textbox', { name: 'title' }), '!');
    expect(screen.getByRole('status', { name: 'Inspector messages' })).toHaveTextContent(
      'title updated',
    );
    await user.paste('very-long-rejected-value');
    expect(screen.getByRole('status', { name: 'Inspector messages' })).toHaveTextContent(
      'title rejected',
    );
  });
});

// Matches exactly the card's `title` property — schema identity, so the other
// string rows (slug) are untouched and each assertion targets ONE row.
const stringMatcher = (schema: unknown) => (schema === CARD_PROPS.shape.title ? 10 : 0);

const CustomText = (props: { value: unknown; onChange: (next: unknown) => void }) => (
  <input
    data-testid="custom-field"
    value={typeof props.value === 'string' ? props.value : ''}
    onChange={(event) => {
      props.onChange(event.target.value);
    }}
  />
);

const SecondCustomText = (props: { value: unknown }) => (
  <input
    data-testid="custom-field-v2"
    readOnly
    value={typeof props.value === 'string' ? props.value : ''}
  />
);

const Throwing = () => {
  throw new Error('render exploded');
};

describe('US3 — field types are extensible, live (007 contract §1/§2)', () => {
  it('AC1/AC2: a runtime-registered field type replaces the default and disposal restores it', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);
    expect(screen.getByRole('textbox', { name: 'title' })).toBeInTheDocument();

    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'custom-fields',
        version: '1.0.0',
        contributes: {
          fieldTypes: [
            {
              id: 'fancy-string',
              match: stringMatcher,
              load: () => Promise.resolve({ default: CustomText }),
            },
          ],
        },
      });
    });
    // Lazy load resolves in a microtask — no reload anywhere.
    expect(await screen.findByTestId('custom-field')).toHaveValue('Hello');

    act(() => {
      kernel.extensions.dispose('custom-fields');
    });
    expect(screen.queryByTestId('custom-field')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
  });

  it('AC3a: a loader that rejects is contained — the property keeps the default control', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'broken-loader',
        version: '1.0.0',
        contributes: {
          fieldTypes: [
            {
              id: 'never-loads',
              match: stringMatcher,
              load: () => Promise.reject(new Error('bundle missing')),
            },
          ],
        },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    const input = screen.getByRole('textbox', { name: 'title' });
    expect(input).toHaveValue('Hello');
    await user.type(input, '!'); // still fully functional
    expect(kernel.getDocument().nodes['c1']?.props['title']).toBe('Hello!');
  });

  it('AC3b: a component that throws on render falls back to the default; the panel survives', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'throwing-field',
        version: '1.0.0',
        contributes: {
          fieldTypes: [
            {
              id: 'explodes',
              match: stringMatcher,
              load: () => Promise.resolve({ default: Throwing }),
            },
          ],
        },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Containment: the string property is a default control again, and every
    // OTHER row was never disturbed.
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    expect(screen.getByRole('combobox', { name: 'tone' })).toHaveValue('light');
    expect(screen.getByRole('switch', { name: 'featured' })).toBeInTheDocument();
  });

  it('R8: a focused control keeps its renderer until blur even when a better match registers', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    const input = screen.getByRole('textbox', { name: 'title' });
    await user.click(input); // focus locks the resolution
    expect(input).toHaveFocus();

    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'late-fields',
        version: '1.0.0',
        contributes: {
          fieldTypes: [
            {
              id: 'late-string',
              match: stringMatcher,
              load: () => Promise.resolve({ default: CustomText }),
            },
          ],
        },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Mid-typing: the DEFAULT control is still mounted and still focused.
    expect(screen.queryByTestId('custom-field')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveFocus();

    await user.click(screen.getByRole('switch', { name: 'featured' })); // leave the row
    expect(await screen.findByTestId('custom-field')).toBeInTheDocument();
  });
});

describe('review fixes (007 §10)', () => {
  it('H2(kernel-lens): a min(1) prop never snaps back mid-edit and recovers cleanly', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    const slug = screen.getByRole('textbox', { name: 'slug' });
    expect(slug).toHaveValue('Go');

    await user.type(slug, '{Backspace}{Backspace}'); // 'G' commits, '' is rejected
    expect(kernel.getDocument().nodes['c1']?.props['slug']).toBe('G'); // last valid
    expect(slug).toHaveValue(''); // the DRAFT — no snap-back to 'G'
    const describedBy = slug.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy ?? '')?.textContent).not.toHaveLength(0);

    await user.type(slug, 'Hi'); // typing recovers straight from the draft
    expect(kernel.getDocument().nodes['c1']?.props['slug']).toBe('Hi');
    expect(slug).toHaveValue('Hi');
  });

  it('M1: re-registering the SAME field-type id loads the NEW component (per-def cache)', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'brand-v1',
        version: '1.0.0',
        contributes: {
          fieldTypes: [
            {
              id: 'brand',
              match: stringMatcher,
              load: () => Promise.resolve({ default: CustomText }),
            },
          ],
        },
      });
    });
    expect(await screen.findByTestId('custom-field')).toBeInTheDocument();

    act(() => {
      kernel.extensions.dispose('brand-v1');
    });
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'brand-v2',
        version: '2.0.0',
        contributes: {
          fieldTypes: [
            {
              id: 'brand', // SAME id, different contribution — the id is a slot name
              match: stringMatcher,
              load: () => Promise.resolve({ default: SecondCustomText }),
            },
          ],
        },
      });
    });
    expect(await screen.findByTestId('custom-field-v2')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-field')).not.toBeInTheDocument();
  });

  it('M5: the lazy-load interim is a DISABLED default — it cannot accept commits', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    let resolveLoad: ((mod: { default: typeof CustomText }) => void) | null = null;
    const pending = new Promise<{ default: typeof CustomText }>((resolve) => {
      resolveLoad = resolve;
    });
    render(<Inspector kernel={kernel} />);
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'slow-fields',
        version: '1.0.0',
        contributes: { fieldTypes: [{ id: 'slow', match: stringMatcher, load: () => pending }] },
      });
    });
    // While loading: the default control is mounted but INERT.
    expect(screen.getByRole('textbox', { name: 'title' })).toBeDisabled();

    await act(async () => {
      resolveLoad?.({ default: CustomText });
      await pending;
    });
    expect(await screen.findByTestId('custom-field')).toBeInTheDocument();
  });

  it('M6: the override marker is part of the control description, not visual-only', () => {
    const kernel = makeKernel();
    act(() => {
      kernel.dispatch(
        'setResponsive',
        { id: 'c1', breakpoint: 'tablet', key: 'title', value: 'Tab' },
        'user',
      );
    });
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} bucket="tablet" />);
    const input = screen.getByRole('textbox', { name: 'title' });
    const marker = screen.getByText('tablet override');
    expect(input.getAttribute('aria-describedby')).toContain(marker.id);
  });

  it('M4(ux-lens): a rejection does NOT survive a bucket switch (rows are bucket-keyed)', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    const view = render(<Inspector kernel={kernel} bucket="base" />);
    const input = screen.getByRole('textbox', { name: 'title' });
    await user.click(input);
    await user.paste('12345678901'); // > max(10) — rejected, reason shown
    expect(screen.getByText(/./, { selector: '.bldr-inspector__rejection' })).toBeInTheDocument();

    view.rerender(<Inspector kernel={kernel} bucket="tablet" />);
    expect(document.querySelector('.bldr-inspector__rejection')).toBeNull();
  });
});
