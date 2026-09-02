import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  darkTheme,
  DocumentView,
  isColorRole,
  lightTheme,
  paletteOf,
} from '@craftkit/builder-renderer';
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
  align: z.enum(['start', 'center', 'end']).default('start'),
  color: z.string().default('accent'),
  width: z.number().default(320),
});

const PARTITION_PROPS = z.object({
  color: z.string().default('surface'),
  title: z.string().default('Declared design title'),
  advancedMode: z.boolean().default(false),
  ungroupedWidth: z.number().default(640),
});

const ROLE_PROPS = z.object({
  paint: z.enum(['surface', 'accent']).default('surface'),
});

/*
  A colour role the picker CANNOT narrow: no enum to read, so the full palette is
  offered and the validated door is the only thing that refuses. This is the
  fixture the rejection gate needs — with an enum, the refused role is simply not
  shown, which is the fix, not the failure mode worth pinning.
*/
const FREE_ROLE_PROPS = z.object({
  paint: z
    .string()
    .refine((role) => role !== 'surfaceInverse', 'Inverse surface is not available here.')
    .default('surface'),
});

const PAIRED_SPACING_PROPS = z.object({
  marginTop: z.number().default(4),
  marginBottom: z.number().default(8),
  paddingTop: z.number().default(12),
  paddingBottom: z.number().default(16),
  gap: z.number().default(20),
});

// `pair` is deliberately runtime-shaped until the schema owner adds the
// optional BlockPropertyGroup field. Passing this declared data through a
// variable preserves it at runtime without weakening the consumer contract.
const PAIRED_SPACING_GROUPS = {
  marginTop: {
    tab: 'design' as const,
    section: 'Spacing',
    pair: { id: 'margin', label: 'Margin', cellLabel: 'Top' },
  },
  marginBottom: {
    tab: 'design' as const,
    section: 'Spacing',
    pair: { id: 'margin', label: 'Margin', cellLabel: 'Bottom' },
  },
  paddingTop: {
    tab: 'design' as const,
    section: 'Spacing',
    pair: { id: 'padding', label: 'Padding', cellLabel: 'Top' },
  },
  paddingBottom: {
    tab: 'design' as const,
    section: 'Spacing',
    pair: { id: 'padding', label: 'Padding', cellLabel: 'Bottom' },
  },
  gap: { tab: 'design' as const, section: 'Spacing' },
} as const;

const UNPAIRED_SPACING_GROUPS = {
  marginTop: { tab: 'design' as const, section: 'Spacing' },
  marginBottom: { tab: 'design' as const, section: 'Spacing' },
  paddingTop: { tab: 'design' as const, section: 'Spacing' },
  paddingBottom: { tab: 'design' as const, section: 'Spacing' },
  gap: { tab: 'design' as const, section: 'Spacing' },
} as const;

const FEATURES_PROPS = z.object({
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        body: z.string().min(1).max(160),
      }),
    )
    .default([]),
});

const PLAN_SCHEMA = z.object({
  name: z.string().min(1).max(40),
  price: z.string().min(1).max(20),
  period: z.enum(['month', 'year']),
  features: z.array(z.string().min(1).max(80)).max(2),
  highlighted: z.boolean().optional(),
});

const PRICING_PROPS = z.object({
  plans: z
    .array(PLAN_SCHEMA)
    // The shipped schema has min zero. This positive minimum is deliberate so
    // the remove-at-min gate cannot pass without exercising its disabled state.
    .min(1)
    .max(2)
    .default([]),
});

const REJECTING_PRICING_PROPS = z.object({
  plans: z
    .array(PLAN_SCHEMA)
    .min(1)
    .max(2)
    .refine((plans) => plans[0]?.name === 'Starter', {
      message: 'Starter must remain the first plan.',
    }),
});

const TESTIMONIALS_PROPS = z.object({
  items: z
    .array(
      z.object({
        quote: z.string().min(1).max(240),
        author: z.string().min(1).max(60),
        role: z.string().max(60).optional(),
      }),
    )
    .max(2)
    .default([]),
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
          slots: {
            default: {
              allow: [
                'card',
                'plain',
                'exotic',
                'partitioned',
                'paired-spacing',
                'role-card',
                'features',
                'pricing',
                'rejecting-pricing',
                'testimonials',
              ],
            },
          },
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
          type: 'features',
          description: 'Features',
          props: FEATURES_PROPS,
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'pricing',
          description: 'Pricing',
          props: PRICING_PROPS,
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'testimonials',
          description: 'Testimonials',
          props: TESTIMONIALS_PROPS,
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'rejecting-pricing',
          description: 'Rejecting pricing fixture',
          props: REJECTING_PRICING_PROPS,
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'partitioned',
          description: 'Partition declaration proof',
          props: PARTITION_PROPS,
          propertyGroups: {
            // Deliberately contrary to the old name/type heuristics.
            color: { tab: 'content', section: 'Copy' },
            title: { tab: 'design', section: 'Typography' },
            advancedMode: { tab: 'advanced', section: 'Responsive' },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'role-card',
          description: 'Explicit page colour role proof',
          props: ROLE_PROPS,
          propertyGroups: {
            // `paint` deliberately contains no colour-like word: only this declaration selects
            // the role picker. Mutation: remove `kind` and the named picker gate fails.
            paint: { tab: 'design', section: 'Appearance', kind: 'color-role' },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'free-role-card',
          description: 'Colour role with no enum to narrow by',
          props: FREE_ROLE_PROPS,
          propertyGroups: {
            paint: { tab: 'design', section: 'Appearance', kind: 'color-role' },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'paired-spacing',
          description: 'Explicit paired spacing declaration proof',
          props: PAIRED_SPACING_PROPS,
          propertyGroups: PAIRED_SPACING_GROUPS,
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'unpaired-spacing',
          description: 'Same-named spacing without a pair declaration',
          props: PAIRED_SPACING_PROPS,
          propertyGroups: UNPAIRED_SPACING_GROUPS,
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'exotic',
          description: 'Exotic',
          props: z.object({ meta: z.record(z.string(), z.string()).default({}) }),
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
    root: {
      id: 'root',
      type: 'page',
      props: {},
      slots: {
        default: [
          'c1',
          'pl1',
          'ex1',
          'partitioned1',
          'pairedSpacing1',
          'role1',
          'freeRole1',
          'features1',
          'pricing1',
          'rejectingPricing1',
          'quotes1',
        ],
      },
    },
    c1: {
      id: 'c1',
      type: 'card',
      props: {
        title: 'Hello',
        tone: 'light',
        featured: false,
        count: 3,
        slug: 'Go',
        align: 'center',
        color: 'accent',
        width: 320,
      },
    },
    pl1: { id: 'pl1', type: 'plain', props: {} },
    ex1: { id: 'ex1', type: 'exotic', props: { meta: { a: 'b' } } },
    partitioned1: {
      id: 'partitioned1',
      type: 'partitioned',
      props: {
        color: 'surface',
        title: 'Declared design title',
        advancedMode: false,
        ungroupedWidth: 640,
      },
    },
    pairedSpacing1: {
      id: 'pairedSpacing1',
      type: 'paired-spacing',
      props: {
        marginTop: 4,
        marginBottom: 8,
        paddingTop: 12,
        paddingBottom: 16,
        gap: 20,
      },
    },
    role1: { id: 'role1', type: 'role-card', props: { paint: 'surface' } },
    freeRole1: { id: 'freeRole1', type: 'free-role-card', props: { paint: 'surface' } },
    unpairedSpacing1: {
      id: 'unpairedSpacing1',
      type: 'unpaired-spacing',
      props: {
        marginTop: 4,
        marginBottom: 8,
        paddingTop: 12,
        paddingBottom: 16,
        gap: 20,
      },
    },
    features1: {
      id: 'features1',
      type: 'features',
      props: { items: [{ title: 'Fast setup', body: 'Start in minutes.' }] },
    },
    pricing1: {
      id: 'pricing1',
      type: 'pricing',
      props: {
        plans: [
          {
            name: 'Starter',
            price: '$9',
            period: 'month',
            features: ['Projects'],
            highlighted: false,
          },
          {
            name: 'Growth',
            price: '$29',
            period: 'month',
            features: ['Analytics'],
            highlighted: true,
          },
        ],
      },
    },
    rejectingPricing1: {
      id: 'rejectingPricing1',
      type: 'rejecting-pricing',
      props: {
        plans: [
          {
            name: 'Starter',
            price: '$9',
            period: 'month',
            features: ['Projects'],
            highlighted: false,
          },
          {
            name: 'Growth',
            price: '$29',
            period: 'month',
            features: ['Analytics'],
            highlighted: true,
          },
        ],
      },
    },
    quotes1: {
      id: 'quotes1',
      type: 'testimonials',
      props: {
        items: [{ quote: 'The builder finally feels obvious.', author: 'Ari', role: 'Designer' }],
      },
    },
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

    expect(screen.getByRole('heading', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('Card');
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    expect(screen.getByRole('combobox', { name: 'tone' })).toHaveValue('light');
    expect(screen.getByRole('switch', { name: 'featured' })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'count' })).toHaveValue(3);
    expect(screen.getByRole('group', { name: 'align' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'align' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Center alignment' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const color = screen.getByRole('textbox', { name: 'color' });
    expect(color).toHaveValue('accent');
    expect(color.closest('.bldr-inspector__row')?.querySelector('[role="radiogroup"]')).toBeNull();
    const width = screen.getByRole('spinbutton', { name: 'width' });
    expect(width).toHaveValue(320);
    expect(width.nextElementSibling).toHaveTextContent('px');
  });

  it('renders effective schema defaults when document properties are omitted', () => {
    const documentWithOmittedDefaults: BuilderDocument = {
      ...DOC,
      nodes: {
        ...DOC.nodes,
        c1: { id: 'c1', type: 'card', props: {} },
      },
    };
    const kernel = createBuilder({
      document: documentWithOmittedDefaults,
      extensions: [VOCAB],
      ports: { clock: fixedClock(), ids: seededIds('defaults') },
    });
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);

    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hi');
    expect(screen.getByRole('combobox', { name: 'tone' })).toHaveValue('light');
    expect(screen.getByRole('switch', { name: 'featured' })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'count' })).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Start alignment' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('spinbutton', { name: 'width' })).toHaveValue(320);
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
    // Nothing to clear, so nothing offers to: the control exists only while
    // a block is selected.
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
  });

  it('a selected block offers Clear selection in the title row: it empties the selection with no transaction and says so', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    const before = txCount(kernel);

    const clear = screen.getByRole('button', { name: 'Clear selection' });
    expect(clear.closest('.bldr-inspector__title-row')).not.toBeNull();
    // Quiet, small chrome: the panel's own button recipe, not a bespoke one.
    expect(clear).toHaveAttribute('data-bldr-chrome-button', '');
    expect(clear).toHaveAttribute('data-size', 'sm');
    expect(clear).toHaveAttribute('data-variant', 'quiet');
    expect(clear.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    await user.click(clear);

    expect(kernel.context.store.getState().selection).toEqual([]);
    expect(txCount(kernel)).toBe(before); // selection is never a transaction
    expect(screen.getByText('Select a block to edit its properties.')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Inspector messages' })).toHaveTextContent(
      'Selection cleared',
    );
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
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
    expect(readonly).toHaveValue('{"a":"b"}');
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

describe('Inspector page colour roles', () => {
  it('resolves an explicitly declared non-colour-named property to the role picker', () => {
    // Mutation: drop the property-kind handoff (or restore name inference) and this named gate
    // finds a textbox instead of the complete palette radiogroup.
    const kernel = makeKernel();
    kernel.setSelection(['role1']);
    render(<Inspector kernel={kernel} theme={lightTheme} />);

    const group = screen.getByRole('radiogroup', { name: 'paint' });
    /*
      Exactly the roles the property admits, not the whole theme. `paint` is
      declared `z.enum(['surface', 'accent'])`, so offering the other five would
      be offering choices the validated door refuses — a swatch that does
      nothing and then explains itself. Asserted as an exact set, because a
      count alone passes if the picker shows the wrong two.
    */
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label')),
    ).toEqual(['Surface', 'Accent']);
    expect(within(group).getByRole('radio', { name: 'Surface' })).toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'paint' })).toBeNull();
  });

  it('derives swatches from the active page theme without changing the stored role', () => {
    // Mutation: hard-code `paletteOf(lightTheme)` in Inspector; the dark-theme swatch differs and
    // this named gate fails while also proving that palette resolution itself records no write.
    const kernel = makeKernel();
    kernel.setSelection(['role1']);
    const before = txCount(kernel);
    render(<Inspector kernel={kernel} theme={darkTheme} />);

    const darkSurface = paletteOf(darkTheme).find((entry) => entry.role === 'surface');
    const swatch = screen
      .getByRole('radio', { name: 'Surface' })
      .querySelector<HTMLElement>('[data-color-role-swatch="surface"]');
    if (darkSurface === undefined || swatch === null) {
      throw new Error('The active theme and picker must both expose the surface role.');
    }
    const expected = document.createElement('span');
    expected.style.backgroundColor = darkSurface.value;
    expect(swatch.style.backgroundColor).toBe(expected.style.backgroundColor);
    expect(kernel.getDocument().nodes['role1']?.props['paint']).toBe('surface');
    expect(txCount(kernel)).toBe(before);
  });

  it('commits exactly one transaction carrying the role and never the swatch value', async () => {
    // Mutation: dispatch twice or commit `entry.value` instead of `entry.role`; the exact count,
    // stored-role, and swatch-value exclusions make this named gate fail.
    const kernel = makeKernel();
    kernel.setSelection(['role1']);
    const dispatch = vi.spyOn(kernel, 'dispatch');
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} theme={lightTheme} />);

    const before = txCount(kernel);
    await user.click(screen.getByRole('radio', { name: 'Accent' }));

    const applied = kernel.transactions().slice(before);
    const stored = kernel.getDocument().nodes['role1']?.props['paint'];
    expect(dispatch.mock.calls.filter(([command]) => command === 'setProp')).toHaveLength(1);
    expect(applied.map((transaction) => transaction.command)).toEqual(['setProp']);
    expect(applied.flatMap((transaction) => transaction.patches)).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'accent' })]),
    );
    expect(stored).toBe('accent');
    expect(typeof stored === 'string' && isColorRole(stored)).toBe(true);
    expect(paletteOf(lightTheme).map((entry) => entry.value)).not.toContain(stored);
  });

  it('keeps a rejected role on its row and records no transaction', async () => {
    /*
      Uses the fixture whose role property has NO enum: the picker offers every
      role and the door alone refuses. Mutations: drop the refine (opening the
      door), omit the description wiring, or move the reason outside its row.
    */
    const kernel = makeKernel();
    kernel.setSelection(['freeRole1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} theme={lightTheme} />);

    const group = screen.getByRole('radiogroup', { name: 'paint' });
    const before = txCount(kernel);
    const documentBefore = kernel.getDocument();
    await user.click(within(group).getByRole('radio', { name: 'Inverse surface' }));

    expect(txCount(kernel)).toBe(before);
    expect(kernel.getDocument()).toBe(documentBefore);
    expect(kernel.getDocument().nodes['freeRole1']?.props['paint']).toBe('surface');
    const describedBy = group.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const reason = document.getElementById(describedBy ?? '');
    expect(reason).not.toBeNull();
    expect(reason?.textContent).not.toHaveLength(0);
    expect(group.closest('.bldr-inspector__row')).toContainElement(reason);
  });
});

describe('Inspector information design', () => {
  it('partitions rows only by propertyGroups and defaults undeclared rows to Content', async () => {
    // Mutation: grouping by a property name/type heuristic makes this named gate fail.
    const kernel = makeKernel();
    kernel.setSelection(['partitioned1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const tabs = within(screen.getByRole('tablist', { name: 'Inspector tabs' })).getAllByRole(
      'tab',
    );
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Content', 'Design', 'Advanced']);

    const contentPanel = screen.getByRole('tabpanel', { name: 'Content' });
    const ordinaryColor = within(contentPanel).getByRole('textbox', { name: 'color' });
    expect(ordinaryColor).toHaveValue('surface');
    expect(
      ordinaryColor.closest('.bldr-inspector__row')?.querySelector('[role="radiogroup"]'),
    ).toBeNull();
    expect(within(contentPanel).getByRole('spinbutton', { name: 'ungroupedWidth' })).toHaveValue(
      640,
    );
    expect(within(contentPanel).queryByRole('textbox', { name: 'title' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const designPanel = screen.getByRole('tabpanel', { name: 'Design' });
    expect(within(designPanel).getByRole('button', { name: 'Typography' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(within(designPanel).getByRole('textbox', { name: 'title' })).toHaveValue(
      'Declared design title',
    );

    await user.click(screen.getByRole('tab', { name: 'Advanced' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Advanced' })).getByRole('switch', {
        name: 'advancedMode',
      }),
    ).not.toBeChecked();
    expect(screen.getByRole('region', { name: 'Inspector' }).querySelector('[aria-current]')).toBe(
      null,
    );
  });

  it('renders a two-by-two grid only for pairs explicitly declared by the block', async () => {
    // Mutation: change both `const pair = usablePair(declarations?.[propKey]);`
    // lines to add an `?? inferredSpacingPair(propKey)` name-based fallback.
    const kernel = makeKernel();
    kernel.setSelection(['pairedSpacing1']);
    const user = userEvent.setup();
    const { unmount: unmountPaired } = render(<Inspector kernel={kernel} />);

    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const designPanel = screen.getByRole('tabpanel', { name: 'Design' });
    const margin = within(designPanel).getByRole('group', { name: 'Margin' });
    const padding = within(designPanel).getByRole('group', { name: 'Padding' });

    expect(margin).toHaveAttribute('data-property-pair', 'margin');
    expect(within(margin).getByText('Top')).toBeInTheDocument();
    expect(within(margin).getByText('Bottom')).toBeInTheDocument();
    expect(within(margin).getByRole('spinbutton', { name: 'marginTop' })).toHaveValue(4);
    expect(within(margin).getByRole('spinbutton', { name: 'marginBottom' })).toHaveValue(8);
    expect(padding).toHaveAttribute('data-property-pair', 'padding');
    expect(within(padding).getByRole('spinbutton', { name: 'paddingTop' })).toHaveValue(12);
    expect(within(padding).getByRole('spinbutton', { name: 'paddingBottom' })).toHaveValue(16);

    const gap = within(designPanel).getByRole('spinbutton', { name: 'gap' });
    expect(gap.closest('[data-property-pair]')).toBeNull();

    unmountPaired();
    const undeclaredKernel = makeKernel();
    undeclaredKernel.setSelection(['unpairedSpacing1']);
    render(<Inspector kernel={undeclaredKernel} />);
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const undeclaredPanel = screen.getByRole('tabpanel', { name: 'Design' });
    for (const name of ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom']) {
      expect(
        within(undeclaredPanel).getByRole('spinbutton', { name }).closest('[data-property-pair]'),
      ).toBeNull();
    }
  });

  it('tabs use roving tabindex with Arrow keys and Home/End', async () => {
    // Mutation: leaving every tab at tabindex zero or dropping ArrowRight makes this gate fail.
    const kernel = makeKernel();
    kernel.setSelection(['partitioned1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const content = screen.getByRole('tab', { name: 'Content' });
    const design = screen.getByRole('tab', { name: 'Design' });
    const advanced = screen.getByRole('tab', { name: 'Advanced' });
    expect(content).toHaveAttribute('tabindex', '0');
    expect(design).toHaveAttribute('tabindex', '-1');
    expect(advanced).toHaveAttribute('tabindex', '-1');

    content.focus();
    await user.keyboard('{ArrowRight}');
    expect(design).toHaveFocus();
    expect(design).toHaveAttribute('aria-selected', 'true');
    expect(design).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tabpanel', { name: 'Design' })).toHaveAttribute(
      'aria-labelledby',
      design.id,
    );

    await user.keyboard('{End}');
    expect(advanced).toHaveFocus();
    expect(advanced).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(content).toHaveFocus();
    expect(content).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(advanced).toHaveFocus();
    expect(advanced).toHaveAttribute('aria-selected', 'true');
  });

  it('does not render tabs or panels with zero rows', () => {
    // Mutation: rendering the fixed three-tab list makes this named gate fail.
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);

    const inspector = screen.getByRole('region', { name: 'Inspector' });
    expect(inspector.querySelector('[aria-current]')).toBeNull();
    expect(
      within(inspector)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Content']);
    expect(within(inspector).queryByRole('tab', { name: 'Design' })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole('tab', { name: 'Advanced' })).not.toBeInTheDocument();
    expect(within(inspector).getAllByRole('tabpanel', { hidden: true })).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'title' })).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'width' })).toBeVisible();
  });

  it('collapses a controlled section and flips aria-expanded without losing its fields', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const toggle = screen.getByRole('button', { name: 'Content' });
    const regionId = toggle.getAttribute('aria-controls');
    expect(regionId).not.toBeNull();
    const region = document.getElementById(regionId ?? '');
    expect(region).not.toBeNull();
    if (region === null) {
      throw new Error('Content section region was not found');
    }
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(region).not.toHaveAttribute('hidden');
    expect(within(region).getByRole('textbox', { name: 'title' })).toHaveValue('Hello');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(region).toHaveAttribute('hidden');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(region).not.toHaveAttribute('hidden');
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
  });

  it('keeps every generated field control named and tied to its visible label', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} />);

    const nativeControls: readonly (readonly [name: string, control: HTMLElement])[] = [
      ['title', screen.getByRole('textbox', { name: 'title' })],
      ['tone', screen.getByRole('combobox', { name: 'tone' })],
      ['featured', screen.getByRole('switch', { name: 'featured' })],
      ['count', screen.getByRole('spinbutton', { name: 'count' })],
      ['slug', screen.getByRole('textbox', { name: 'slug' })],
      ['color', screen.getByRole('textbox', { name: 'color' })],
      ['width', screen.getByRole('spinbutton', { name: 'width' })],
    ];

    for (const [name, control] of nativeControls) {
      expect(control).toHaveAccessibleName(name);
      const label = document.querySelector(`label[for="${control.id}"]`);
      expect(label).not.toBeNull();
      expect(label).toHaveTextContent(name);
    }

    const alignmentGroup = screen.getByRole('group', { name: 'align' });
    expect(alignmentGroup).toHaveAccessibleName('align');
    const alignmentLabelId = alignmentGroup.getAttribute('aria-labelledby');
    expect(alignmentLabelId).not.toBeNull();
    expect(document.getElementById(alignmentLabelId ?? '')).toHaveTextContent('align');
  });

  it('renders alignment as icon segments with exactly one selected option', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const startSegment = screen.getByRole('button', { name: 'Start alignment' });
    const centerSegment = screen.getByRole('button', { name: 'Center alignment' });
    const endSegment = screen.getByRole('button', { name: 'End alignment' });
    const segments = [startSegment, centerSegment, endSegment];
    expect(segments.filter((segment) => segment.getAttribute('aria-pressed') === 'true')).toEqual([
      centerSegment,
    ]);
    startSegment.focus();
    expect(startSegment).toHaveFocus();
    await user.tab();
    expect(centerSegment).toHaveFocus();

    await user.click(endSegment);
    expect(kernel.getDocument().nodes['c1']?.props['align']).toBe('end');
    expect(segments.filter((segment) => segment.getAttribute('aria-pressed') === 'true')).toEqual([
      endSegment,
    ]);
  });

  it('keeps the selected alignment segment a no-op for inherited responsive values', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} bucket="tablet" />);

    const selected = screen.getByRole('button', { name: 'Center alignment' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    const before = txCount(kernel);
    await user.click(selected);

    expect(txCount(kernel)).toBe(before);
    expect(kernel.getDocument().nodes['c1']?.responsive?.tablet?.['align']).toBeUndefined();
    const alignmentRow = selected.closest<HTMLElement>('.bldr-inspector__row');
    expect(alignmentRow).not.toBeNull();
    if (alignmentRow === null) {
      throw new Error('Alignment row was not found');
    }
    expect(within(alignmentRow).queryByText('tablet override')).not.toBeInTheDocument();
  });

  it('mounts a tab body on first activation and keeps it mounted', async () => {
    // Lazy-once: a tab's rows exist only after its first visit, then survive a
    // round trip; every populated tab always has its panel shell.
    const kernel = makeKernel();
    kernel.setSelection(['partitioned1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);
    expect(screen.queryByRole('textbox', { name: 'title', hidden: true })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(screen.getByRole('textbox', { name: 'title', hidden: true })).toBeInTheDocument();
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: 'Content' }));
    expect(screen.getByRole('textbox', { name: 'title', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'title' })).toBeNull();
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);
  });

  it('keeps the invitation and block-name area reachable with no selection', () => {
    const kernel = makeKernel();
    render(<Inspector kernel={kernel} />);

    const inspector = screen.getByRole('region', { name: 'Inspector' });
    expect(within(inspector).getByRole('heading', { name: 'Inspector' })).toBeInTheDocument();
    expect(within(inspector).getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent(
      'No block selected',
    );
    expect(
      within(inspector).getByText('Select a block to edit its properties.'),
    ).toBeInTheDocument();
  });
});

describe('Inspector repeater fields', () => {
  it('labels Features, Pricing, and Testimonials cards from their element schemas', () => {
    // Mutation: falling back to Item N instead of reading required string fields fails this gate.
    const kernel = makeKernel();
    kernel.setSelection(['features1']);
    const { rerender } = render(<Inspector kernel={kernel} />);

    expect(screen.getByRole('button', { name: '1. Fast setup' })).toBeInTheDocument();

    act(() => {
      kernel.setSelection(['pricing1']);
    });
    rerender(<Inspector kernel={kernel} />);
    expect(screen.getByRole('button', { name: '1. Starter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2. Growth' })).toBeInTheDocument();

    act(() => {
      kernel.setSelection(['quotes1']);
    });
    rerender(<Inspector kernel={kernel} />);
    expect(
      screen.getByRole('button', { name: '1. The builder finally feels obvious.' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state, adds a valid object, and defers nested text to one setProp', async () => {
    // Mutation: dispatching from the nested text onChange makes the transaction assertions fail.
    const kernel = makeKernel();
    kernel.dispatch('setProp', { id: 'features1', key: 'items', value: [] }, 'user');
    kernel.setSelection(['features1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const items = screen.getByRole('group', { name: 'items' });
    expect(within(items).getByText('No items yet.')).toBeInTheDocument();

    const beforeAdd = txCount(kernel);
    await user.click(within(items).getByRole('button', { name: 'Add item to items' }));
    expect(
      kernel
        .transactions()
        .slice(beforeAdd)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    expect(within(items).getByRole('button', { name: '1. New title' })).toBeInTheDocument();

    const title = within(items).getByRole('textbox', { name: 'title' });
    const beforeTyping = txCount(kernel);
    await user.type(title, ' updated');
    expect(txCount(kernel)).toBe(beforeTyping);
    await user.keyboard('{Enter}');
    expect(
      kernel
        .transactions()
        .slice(beforeTyping)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    expect(kernel.getDocument().nodes['features1']?.props['items']).toEqual([
      { title: 'New title updated', body: 'New body' },
    ]);
  });

  it('gates max/min with reasons and moves or removes in one keyboard-operable transaction', async () => {
    // Mutation: changing a bound, dispatching twice, or leaving card identity behind fails it.
    const kernel = makeKernel();
    kernel.setSelection(['pricing1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const plans = screen.getByRole('group', { name: 'plans' });
    const add = within(plans).getByRole('button', { name: 'Add item to plans' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('Maximum of 2 items reached.');

    const starterDisclosure = within(plans).getByRole('button', { name: '1. Starter' });
    await user.click(starterDisclosure);
    expect(starterDisclosure).toHaveAttribute('aria-expanded', 'false');

    const beforeDown = txCount(kernel);
    within(plans).getByRole('button', { name: 'Move Starter down' }).focus();
    await user.keyboard('{Enter}');
    expect(
      kernel
        .transactions()
        .slice(beforeDown)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    expect(within(plans).getByRole('button', { name: 'Move Starter up' })).toHaveFocus();
    expect(
      (kernel.getDocument().nodes['pricing1']?.props['plans'] as { name: string }[])[0]?.name,
    ).toBe('Growth');
    expect(within(plans).getByRole('button', { name: '2. Starter' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(within(plans).getByRole('button', { name: '1. Growth' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const beforeUp = txCount(kernel);
    within(plans).getByRole('button', { name: 'Move Starter up' }).focus();
    await user.keyboard('{Enter}');
    expect(
      kernel
        .transactions()
        .slice(beforeUp)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    expect(within(plans).getByRole('button', { name: 'Move Starter down' })).toHaveFocus();
    expect(
      (kernel.getDocument().nodes['pricing1']?.props['plans'] as { name: string }[])[0]?.name,
    ).toBe('Starter');

    const beforeRemove = txCount(kernel);
    await user.click(within(plans).getByRole('button', { name: 'Remove Growth' }));
    expect(
      kernel
        .transactions()
        .slice(beforeRemove)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    const remove = within(plans).getByRole('button', { name: 'Remove Starter' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription('Minimum of 1 item required.');
  });

  it('surfaces a rejected structural action only on the item card that caused it', async () => {
    // Mutation: storing one repeater-global action error makes the Growth controls share this error.
    const kernel = makeKernel();
    kernel.setSelection(['rejectingPricing1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const plans = screen.getByRole('group', { name: 'plans' });
    const starterDisclosure = within(plans).getByRole('button', { name: '1. Starter' });
    const starterCard = starterDisclosure.closest<HTMLElement>('[data-repeater-item]');
    expect(starterCard).not.toBeNull();
    if (starterCard === null) {
      throw new Error('Starter repeater card was not found');
    }

    const moveStarter = within(starterCard).getByRole('button', { name: 'Move Starter down' });
    const before = txCount(kernel);
    moveStarter.focus();
    await user.keyboard('{Enter}');

    expect(txCount(kernel)).toBe(before);
    expect(
      (kernel.getDocument().nodes['rejectingPricing1']?.props['plans'] as { name: string }[])[0]
        ?.name,
    ).toBe('Starter');
    const rejection = within(starterCard).getByText(/Starter must remain the first plan/u);
    expect(moveStarter.getAttribute('aria-describedby')?.split(' ')).toContain(rejection.id);

    const growthCard = within(plans)
      .getByRole('button', { name: '2. Growth' })
      .closest<HTMLElement>('[data-repeater-item]');
    expect(growthCard).not.toBeNull();
    if (growthCard === null) {
      throw new Error('Growth repeater card was not found');
    }
    const moveGrowth = within(growthCard).getByRole('button', { name: 'Move Growth up' });
    expect(moveGrowth.getAttribute('aria-describedby')?.split(' ') ?? []).not.toContain(
      rejection.id,
    );
    expect(within(growthCard).queryByText(/Starter must remain the first plan/u)).toBeNull();
  });

  it('recurses through plans features and commits the nested array through one setProp', async () => {
    // Mutation: rendering an array element read-only instead of recursing makes this gate fail.
    const kernel = makeKernel();
    kernel.setSelection(['pricing1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const plans = screen.getByRole('group', { name: 'plans' });
    const starterToggle = within(plans).getByRole('button', { name: '1. Starter' });
    const starterCard = starterToggle.closest<HTMLElement>('[data-repeater-item]');
    expect(starterCard).not.toBeNull();
    if (starterCard === null) {
      throw new Error('Starter repeater card was not found');
    }

    const features = within(starterCard).getByRole('group', { name: 'features' });
    expect(within(features).getByRole('button', { name: '1. Projects' })).toBeInTheDocument();
    const before = txCount(kernel);
    await user.click(within(features).getByRole('button', { name: 'Add item to features' }));
    expect(
      kernel
        .transactions()
        .slice(before)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    expect(within(features).getByRole('button', { name: '2. New item' })).toBeInTheDocument();
  });

  it('keeps a rejected nested draft on the exact child row without a transaction', async () => {
    // Mutation: swallowing the child rejection or attaching it only to the array row fails this gate.
    const kernel = makeKernel();
    kernel.setSelection(['pricing1']);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    const plans = screen.getByRole('group', { name: 'plans' });
    const starterCard = within(plans)
      .getByRole('button', { name: '1. Starter' })
      .closest<HTMLElement>('[data-repeater-item]');
    expect(starterCard).not.toBeNull();
    if (starterCard === null) {
      throw new Error('Starter repeater card was not found');
    }

    const name = within(starterCard).getByRole('textbox', { name: 'name' });
    const before = txCount(kernel);
    await user.clear(name);
    expect(txCount(kernel)).toBe(before);
    await user.tab();

    expect(txCount(kernel)).toBe(before);
    expect(name).toHaveValue('');
    const row = name.closest<HTMLElement>('.bldr-inspector__row');
    expect(row).not.toBeNull();
    const rejection = row?.querySelector<HTMLElement>('.bldr-inspector__rejection');
    expect(rejection?.textContent).not.toHaveLength(0);
    expect(name.getAttribute('aria-describedby')?.split(' ')).toContain(rejection?.id);
    expect(
      (kernel.getDocument().nodes['pricing1']?.props['plans'] as { name: string }[])[0]?.name,
    ).toBe('Starter');
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

  it('marks root rows as device-override capable before an override exists without renaming or committing', () => {
    // Mutation: change `const supportsDeviceOverride = responsiveCapable;` to
    // `const supportsDeviceOverride = responsiveCapable && hasOverride;`.
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const before = txCount(kernel);
    const documentBefore = kernel.getDocument();
    const view = render(<Inspector kernel={kernel} bucket="tablet" />);

    const title = screen.getByRole('textbox', { name: 'title' });
    const titleRow = title.closest<HTMLElement>('.bldr-inspector__row');
    expect(titleRow).not.toBeNull();
    if (titleRow === null) {
      throw new Error('The title row was not found');
    }
    expect(
      within(titleRow).getByRole('img', { name: 'Supports device overrides' }),
    ).toBeInTheDocument();
    expect(title).toHaveAccessibleName('title');
    expect(screen.queryByText('tablet override')).toBeNull();
    expect(txCount(kernel)).toBe(before);
    expect(kernel.getDocument()).toBe(documentBefore);

    act(() => {
      kernel.setSelection(['pricing1']);
    });
    view.rerender(<Inspector kernel={kernel} bucket="tablet" />);
    const plans = screen.getByRole('group', { name: 'plans' });
    const plansRow = plans.closest<HTMLElement>('.bldr-inspector__row');
    expect(plansRow).not.toBeNull();
    if (plansRow === null) {
      throw new Error('The plans row was not found');
    }
    expect(
      within(plansRow).getByRole('img', { name: 'Supports device overrides' }),
    ).toBeInTheDocument();

    const starterCard = within(plans)
      .getByRole('button', { name: '1. Starter' })
      .closest<HTMLElement>('[data-repeater-item]');
    expect(starterCard).not.toBeNull();
    if (starterCard === null) {
      throw new Error('The starter card was not found');
    }
    const nestedName = within(starterCard).getByRole('textbox', { name: 'name' });
    const nestedNameRow = nestedName.closest<HTMLElement>('.bldr-inspector__row');
    expect(nestedNameRow).not.toBeNull();
    if (nestedNameRow === null) {
      throw new Error('The nested name row was not found');
    }
    expect(
      within(nestedNameRow).queryByRole('img', { name: 'Supports device overrides' }),
    ).toBeNull();
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
