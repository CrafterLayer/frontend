import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type FieldProps,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { COLOR_ROLES, isColorRole, lightTheme, paletteOf } from '@craftkit/builder-renderer';

import { EditorCanvas } from '../EditorCanvas';
import { Inspector } from './Inspector';

const SlotRender = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;
const STORY_PALETTE = paletteOf(lightTheme);

const CardRender = ((props: { props: { title?: string; badge?: string; paint?: string } }) => {
  const entry =
    typeof props.props.paint === 'string' && isColorRole(props.props.paint)
      ? STORY_PALETTE.find((candidate) => candidate.role === props.props.paint)
      : undefined;
  return (
    <article
      data-testid="inspector-story-card"
      style={{
        backgroundColor: entry === undefined ? undefined : `var(${entry.cssVar})`,
        fontFamily: 'var(--bldr-font)',
        fontSize: 'var(--bldr-font-size-body)',
        paddingBlock: 'var(--bldr-space-3xl)',
        paddingInline: 'var(--bldr-space-3xl)',
      }}
    >
      {props.props.title ?? ''} <small>{props.props.badge ?? ''}</small>
    </article>
  );
}) as unknown as BlockRenderComponent;

const CARD_PROPS = z.object({
  // title is UNBOUNDED so the EditProps play stays rerun-idempotent forever;
  // badge carries the constraint the Rejection play needs.
  title: z.string().default('Card title'),
  badge: z.string().max(5).default('New'),
  tone: z.enum(['light', 'dark']).default('light'),
  featured: z.boolean().default(false),
  columns: z.number().default(2),
  font: z.enum(['Inter', 'IBM Plex Sans', 'Georgia']).default('Inter'),
  weight: z.enum(['400', '500', '600', '700']).default('500'),
  size: z.number().default(16),
  lineHeight: z.number().default(24),
  letterSpacing: z.number().default(0),
  align: z.enum(['start', 'center', 'end']).default('start'),
  paint: z.enum(COLOR_ROLES).default('surface'),
  marginTop: z.number().default(0),
  marginBottom: z.number().default(0),
  paddingTop: z.number().default(24),
  paddingBottom: z.number().default(24),
  gap: z.number().default(16),
  width: z.number().default(320),
  responsive: z.boolean().default(true),
});

// The runtime declaration is ready for the schema-owned optional `pair` type.
// Pairing never comes from a field or section name: each property names its
// pair identity, one pair label, and its visible grid-cell label.
const CARD_PROPERTY_GROUPS = {
  title: { tab: 'content' as const, section: 'Content' },
  badge: { tab: 'content' as const, section: 'Content' },
  tone: { tab: 'design' as const, section: 'Color' },
  featured: { tab: 'advanced' as const, section: 'Structure' },
  columns: { tab: 'design' as const, section: 'Layout' },
  font: { tab: 'design' as const, section: 'Typography' },
  weight: { tab: 'design' as const, section: 'Typography' },
  size: { tab: 'design' as const, section: 'Typography' },
  lineHeight: { tab: 'design' as const, section: 'Typography' },
  letterSpacing: { tab: 'design' as const, section: 'Typography' },
  align: { tab: 'design' as const, section: 'Alignment' },
  // Deliberately not named colour/color: only this declaration selects the role picker.
  paint: { tab: 'design' as const, section: 'Color', kind: 'color-role' as const },
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
  width: { tab: 'design' as const, section: 'Width' },
  responsive: { tab: 'advanced' as const, section: 'Responsive' },
} as const;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inspector-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['card'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
          props: CARD_PROPS,
          propertyGroups: CARD_PROPERTY_GROUPS,
          examples: [],
        }),
        render: CardRender,
      },
    ],
  },
};

const doc = (dir: 'ltr' | 'rtl'): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1'] } },
    c1: {
      id: 'c1',
      type: 'card',
      props: {
        title: 'Launch hero',
        badge: 'New',
        tone: 'dark',
        featured: true,
        columns: 3,
        font: 'Inter',
        weight: '500',
        size: 16,
        lineHeight: 24,
        letterSpacing: 0,
        align: 'center',
        paint: 'surface',
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 24,
        paddingBottom: 24,
        gap: 16,
        width: 320,
        responsive: true,
      },
      responsive: { tablet: { title: 'Tablet title' } },
    },
  },
});

const makeKernel = (dir: 'ltr' | 'rtl' = 'ltr', select = true) => {
  const kernel = createBuilder({
    document: doc(dir),
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('is') },
  });
  if (select) {
    kernel.setSelection(['c1']);
  }
  return kernel;
};

const REPEATER_PROPS = z.object({
  plans: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        price: z.string().min(1).max(20),
        period: z.enum(['month', 'year']),
        features: z.array(z.string().min(1).max(80)).max(8),
        highlighted: z.boolean().optional(),
      }),
    )
    .max(4)
    .default([]),
});

const REPEATER_VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inspector-repeater-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'repeater-page',
          description: 'Repeater page',
          props: z.object({}),
          slots: { default: { allow: ['repeater-pricing'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'repeater-pricing',
          description: 'Pricing repeater',
          props: REPEATER_PROPS,
          propertyGroups: { plans: { tab: 'content', section: 'Plans' } },
          examples: [],
        }),
        render: CardRender,
      },
    ],
  },
};

const makeRepeaterKernel = () => {
  const kernel = createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'repeater-root',
      nodes: {
        'repeater-root': {
          id: 'repeater-root',
          type: 'repeater-page',
          props: {},
          slots: { default: ['repeater-pricing'] },
        },
        'repeater-pricing': {
          id: 'repeater-pricing',
          type: 'repeater-pricing',
          props: {
            plans: [
              {
                name: 'Starter',
                price: '$9',
                period: 'month',
                features: ['Projects', 'Support'],
                highlighted: false,
              },
              {
                name: 'Growth',
                price: '$29',
                period: 'month',
                features: ['Analytics', 'Automation'],
                highlighted: true,
              },
            ],
          },
        },
      },
    },
    extensions: [REPEATER_VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('repeater-story') },
  });
  kernel.setSelection(['repeater-pricing']);
  return kernel;
};

const meta = {
  title: 'Builder/Shell/Inspector',
  component: Inspector,
  args: { theme: lightTheme },
} satisfies Meta<typeof Inspector>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { kernel: makeKernel('ltr', false) },
};

export const EmptyState: Story = {
  args: { kernel: makeKernel('ltr', false) },
};

export const Selected: Story = {
  args: { kernel: makeKernel() },
};

export const AllSectionsExpanded: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      within(canvas.getByRole('tabpanel', { name: 'Content' })).getByRole('button', {
        name: 'Content',
      }),
    ).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(canvas.getByRole('tab', { name: 'Design' }));
    const designPanel = canvas.getByRole('tabpanel', { name: 'Design' });
    for (const name of ['Typography', 'Alignment', 'Color', 'Layout', 'Spacing', 'Width']) {
      await expect(within(designPanel).getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    }

    await userEvent.click(canvas.getByRole('tab', { name: 'Advanced' }));
    const advancedPanel = canvas.getByRole('tabpanel', { name: 'Advanced' });
    for (const name of ['Structure', 'Responsive']) {
      await expect(within(advancedPanel).getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    }
  },
};

export const DeclaredPropertyTabs: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inspector = canvas.getByRole('region', { name: 'Inspector' });
    await expect(inspector.querySelector('[aria-current]')).toBeNull();
    const tabs = within(inspector).getAllByRole('tab');
    await expect(tabs.map((tab) => tab.textContent)).toEqual(['Content', 'Design', 'Advanced']);
    await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await expect(within(inspector).getByRole('tabpanel', { name: 'Content' })).toBeVisible();

    await userEvent.click(within(inspector).getByRole('tab', { name: 'Design' }));
    const designPanel = within(inspector).getByRole('tabpanel', { name: 'Design' });
    await expect(designPanel).toHaveAttribute(
      'aria-labelledby',
      within(inspector).getByRole('tab', { name: 'Design' }).id,
    );
    await expect(within(designPanel).getByRole('group', { name: 'align' })).toBeVisible();
  },
};

export const LabelAboveFullWidthControl: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('textbox', { name: 'title' });
    const row = title.closest<HTMLElement>('.bldr-inspector__row');
    const slot = title.closest<HTMLElement>('.bldr-inspector__control-slot');
    const label = row?.querySelector<HTMLLabelElement>('label[for]');
    if (row === null || slot === null || label === null || label === undefined) {
      throw new Error('The title row did not expose its measured label and control boxes.');
    }

    const rowRect = row.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const inputRect = title.getBoundingClientRect();
    await expect(rowRect.width).toBeGreaterThan(0);
    await expect(labelRect.height).toBeGreaterThan(0);
    await expect(inputRect.height).toBeGreaterThan(0);
    await expect(labelRect.bottom).toBeLessThanOrEqual(inputRect.top);
    await expect(Math.abs(inputRect.width - slotRect.width)).toBeLessThanOrEqual(0.5);
    await expect(Math.abs(inputRect.width - rowRect.width)).toBeLessThanOrEqual(0.5);

    // This story proves the rendered two-by-two geometry for declared pairs.
    // The Inspector jsdom test carries the matching no-name-inference mutation gate.
    await userEvent.click(canvas.getByRole('tab', { name: 'Design' }));
    const margin = canvas.getByRole('group', { name: 'Margin' });
    const padding = canvas.getByRole('group', { name: 'Padding' });
    const marginTop = within(margin).getByRole('spinbutton', { name: 'marginTop' });
    const marginBottom = within(margin).getByRole('spinbutton', { name: 'marginBottom' });
    const paddingTop = within(padding).getByRole('spinbutton', { name: 'paddingTop' });
    const paddingBottom = within(padding).getByRole('spinbutton', { name: 'paddingBottom' });
    const marginTopRect = marginTop.getBoundingClientRect();
    const marginBottomRect = marginBottom.getBoundingClientRect();
    const paddingTopRect = paddingTop.getBoundingClientRect();
    const paddingBottomRect = paddingBottom.getBoundingClientRect();
    const marginRect = margin.getBoundingClientRect();
    const paddingRect = padding.getBoundingClientRect();

    await expect(within(margin).getByText('Top')).toBeVisible();
    await expect(within(margin).getByText('Bottom')).toBeVisible();
    await expect(within(padding).getByText('Top')).toBeVisible();
    await expect(within(padding).getByText('Bottom')).toBeVisible();
    await expect(margin.getAttribute('data-property-pair')).toBe('margin');
    await expect(padding.getAttribute('data-property-pair')).toBe('padding');
    await expect(marginRect.width).toBeGreaterThan(0);
    await expect(paddingRect.width).toBeGreaterThan(0);
    await expect(Math.abs(marginTopRect.top - marginBottomRect.top)).toBeLessThanOrEqual(0.5);
    await expect(Math.abs(paddingTopRect.top - paddingBottomRect.top)).toBeLessThanOrEqual(0.5);
    await expect(paddingTopRect.top).toBeGreaterThan(marginTopRect.bottom);
    await expect(marginTopRect.width).toBeLessThan(marginRect.width);
    await expect(paddingTopRect.width).toBeLessThan(paddingRect.width);

    const gap = canvas.getByRole('spinbutton', { name: 'gap' });
    await expect(gap.closest('[data-property-pair]')).toBeNull();
  },
};

export const SegmentedAlignmentControlScale: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    // Mutation: reading the touch-target token instead of control-sm fails this named story.
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Design' }));
    const inspector = canvas.getByRole('region', { name: 'Inspector' });
    const target = Number.parseFloat(
      getComputedStyle(inspector).getPropertyValue('--bldr-control-sm'),
    );
    await expect(target).toBeGreaterThan(0);

    const group = canvas.getByRole('group', { name: 'align' });
    const segments = within(group).getAllByRole('button');
    await expect(segments).toHaveLength(3);
    for (const segment of segments) {
      const rect = segment.getBoundingClientRect();
      await expect(Math.abs(rect.width - target)).toBeLessThanOrEqual(0.5);
      await expect(Math.abs(rect.height - target)).toBeLessThanOrEqual(0.5);
    }
  },
};

const repeaterSizingKernel = makeRepeaterKernel();
export const RepeaterControlScaleAndFit: Story = {
  args: { kernel: repeaterSizingKernel },
  play: async ({ canvasElement }) => {
    // Mutation: a zero-sized control, canvas-sized action, or card overflow fails this gate.
    const canvas = within(canvasElement);
    const inspector = canvas.getByRole('region', { name: 'Inspector' });
    const plans = canvas.getByRole('group', { name: 'plans' });
    const repeater = plans.querySelector<HTMLElement>('.bldr-repeater');
    if (repeater === null) {
      throw new Error('The measured plans repeater was not rendered.');
    }

    const inspectorRect = inspector.getBoundingClientRect();
    const repeaterRect = repeater.getBoundingClientRect();
    const cards = [...repeater.querySelectorAll<HTMLElement>('[data-repeater-item]')];
    const controls = [...repeater.querySelectorAll<HTMLElement>('button, input, select')];
    const actions = [...repeater.querySelectorAll<HTMLElement>('.bldr-repeater__action')];

    await expect(
      Number.parseFloat(getComputedStyle(inspector).getPropertyValue('--bldr-inspector-width')),
    ).toBe(312);
    await expect(inspectorRect.width).toBeGreaterThan(0);
    await expect(repeaterRect.width).toBeGreaterThan(0);
    await expect(cards.length).toBeGreaterThan(1);
    await expect(controls.length).toBeGreaterThan(12);
    await expect(actions.length).toBeGreaterThan(4);
    await expect(repeaterRect.left).toBeGreaterThanOrEqual(inspectorRect.left - 0.5);
    await expect(repeaterRect.right).toBeLessThanOrEqual(inspectorRect.right + 0.5);
    await expect(repeater.scrollWidth).toBeLessThanOrEqual(repeater.clientWidth + 1);
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.left).toBeGreaterThanOrEqual(inspectorRect.left - 0.5);
      await expect(rect.right).toBeLessThanOrEqual(inspectorRect.right + 0.5);
    }
    for (const control of controls) {
      const rect = control.getBoundingClientRect();
      await expect(rect.height).toBeGreaterThanOrEqual(24);
      await expect(rect.height).toBeLessThanOrEqual(36);
      await expect(rect.left).toBeGreaterThanOrEqual(inspectorRect.left - 0.5);
      await expect(rect.right).toBeLessThanOrEqual(inspectorRect.right + 0.5);
    }
    for (const action of actions) {
      const rect = action.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThanOrEqual(24);
      await expect(rect.width).toBeLessThanOrEqual(36);
    }
  },
};

export const CollapsedSection: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = within(canvas.getByRole('tabpanel', { name: 'Content' })).getByRole('button', {
      name: 'Content',
    });
    if (toggle.getAttribute('aria-expanded') === 'true') {
      await userEvent.click(toggle);
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = canvasElement.ownerDocument.getElementById(
      toggle.getAttribute('aria-controls') ?? '',
    );
    await expect(region).toHaveAttribute('hidden');
  },
};

const editKernel = makeKernel();
export const EditProps: Story = {
  args: { kernel: editKernel },
  play: async ({ canvasElement }) => {
    // Idempotent: typing appends per rerun — we assert GROWTH and document
    // truth, never an absolute value.
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'title' });
    const before = editKernel.transactions().length;
    await userEvent.type(input, '!');
    await expect(editKernel.transactions().length).toBe(before + 1);
    const title = editKernel.getDocument().nodes['c1']?.props['title'];
    await expect(typeof title === 'string' && title.endsWith('!')).toBe(true);
  },
};

export const TabletOverrides: Story = {
  args: { kernel: makeKernel(), bucket: 'tablet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Editing tablet overrides')).toBeInTheDocument();
    await expect(canvas.getByText('tablet override')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'title' })).toHaveValue('Tablet title');
  },
};

const deviceCapabilityKernel = makeKernel();
export const DeviceOverrideCapability: Story = {
  args: { kernel: deviceCapabilityKernel, bucket: 'tablet' },
  play: async ({ canvasElement }) => {
    // Mutation: change `const supportsDeviceOverride = responsiveCapable;` to
    // `const supportsDeviceOverride = responsiveCapable && hasOverride;`.
    const canvas = within(canvasElement);
    const inspector = canvas.getByRole('region', { name: 'Inspector' });
    const width = canvas.getByRole('spinbutton', { name: 'width' });
    const row = width.closest<HTMLElement>('.bldr-inspector__row');
    if (row === null) {
      throw new Error('The width row did not expose a device-override glyph.');
    }
    const glyph = within(row).getByRole('img', { name: 'Supports device overrides' });
    const icon = glyph.querySelector('svg');
    if (icon === null) {
      throw new Error('The device-override glyph did not render an SVG.');
    }

    const controlSmall = Number.parseFloat(
      getComputedStyle(inspector).getPropertyValue('--bldr-control-sm'),
    );
    const glyphRect = glyph.getBoundingClientRect();
    await expect(controlSmall).toBeGreaterThan(0);
    await expect(Math.abs(glyphRect.width - controlSmall)).toBeLessThanOrEqual(0.5);
    await expect(Math.abs(glyphRect.height - controlSmall)).toBeLessThanOrEqual(0.5);
    await expect(icon).toHaveAttribute('viewBox', '0 0 16 16');
    await expect(icon).toHaveAttribute('stroke', 'currentColor');
    await expect(icon).toHaveAttribute('stroke-width', '1.5');
    await expect(width).toHaveAccessibleName('width');
    await expect(within(row).queryByText('tablet override')).toBeNull();
    await expect(deviceCapabilityKernel.transactions()).toHaveLength(0);
  },
};

export const RightToLeft: Story = {
  args: { kernel: makeKernel('rtl') },
  globals: { direction: 'rtl' },
};

const rejectionKernel = makeKernel();
export const Rejection: Story = {
  args: { kernel: rejectionKernel },
  play: async ({ canvasElement }) => {
    // Idempotent: the over-long value is rejected every rerun — zero document
    // change, the reason described control-adjacent (contract §7 row 2).
    const canvas = within(canvasElement);
    const badge = canvas.getByRole('textbox', { name: 'badge' });
    const txBefore = rejectionKernel.transactions().length;
    await userEvent.click(badge);
    await userEvent.paste('far-too-long-for-max-five');
    await expect(rejectionKernel.transactions().length).toBe(txBefore);
    const describedBy = badge.getAttribute('aria-describedby');
    await expect(describedBy).not.toBeNull();
    const reason = canvasElement.ownerDocument.getElementById(describedBy ?? '');
    await expect(reason?.textContent.length ?? 0).toBeGreaterThan(0);
  },
};

const invalidValueKernel = makeKernel();
export const InvalidValueRefusal: Story = {
  args: { kernel: invalidValueKernel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByRole('textbox', { name: 'badge' });
    const txBefore = invalidValueKernel.transactions().length;
    await userEvent.click(badge);
    await userEvent.paste('far-too-long-for-max-five');
    await expect(invalidValueKernel.transactions().length).toBe(txBefore);
    const describedBy = badge.getAttribute('aria-describedby');
    await expect(describedBy).not.toBeNull();
    const reason = canvasElement.ownerDocument.getElementById(describedBy ?? '');
    await expect(reason?.textContent.length ?? 0).toBeGreaterThan(0);
  },
};

// A REALISTIC contributed field: it consumes only the public FieldProps and
// ignores the shell extras — the row's structural label must still name it
// (review H2; this story is what puts that path under the catalog a11y gate).
const BadgePicker = ({ value, onChange }: FieldProps) => (
  <div style={{ display: 'flex', gap: 'var(--bldr-space-xs)' }}>
    {['New', 'Hot', 'Sale'].map((option) => (
      <button
        key={option}
        type="button"
        aria-pressed={value === option}
        onClick={() => {
          onChange(option);
        }}
      >
        {option}
      </button>
    ))}
  </div>
);

const contributedKernel = makeKernel();
contributedKernel.extensions.register({
  tier: 1,
  name: 'story-badge-field',
  version: '1.0.0',
  contributes: {
    fieldTypes: [
      {
        id: 'badge-picker',
        // Schema identity: exactly the card's `badge` property, nothing else.
        match: (schema) => (schema === CARD_PROPS.shape.badge ? 10 : 0),
        load: () => Promise.resolve({ default: BadgePicker }),
      },
    ],
  },
});
export const ContributedField: Story = {
  args: { kernel: contributedKernel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The custom control replaced the default text input for `badge`…
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'New' })).toBeInTheDocument();
    });
    // …and one pick is one transaction through the door.
    const txBefore = contributedKernel.transactions().length;
    await userEvent.click(canvas.getByRole('button', { name: 'Hot' }));
    await expect(contributedKernel.transactions().length).toBe(txBefore + 1);
    await userEvent.click(canvas.getByRole('button', { name: 'New' })); // idempotent reset
  },
};

const statesKernel = makeKernel('ltr', false);
statesKernel.setSelection(['root']); // the page block has no editable properties
export const NoEditableProperties: Story = {
  args: { kernel: statesKernel },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This block has no editable properties.'),
    ).toBeInTheDocument();
  },
};

const canvasKernel = makeKernel();
export const EditWithCanvas: Story = {
  args: { kernel: canvasKernel },
  render: (args) => (
    <div style={{ blockSize: 'var(--bldr-dock-min-height)', display: 'flex' }}>
      <Inspector kernel={args.kernel} theme={args.theme} />
      <div style={{ flex: 1, minInlineSize: 'var(--bldr-space-0)' }}>
        <EditorCanvas kernel={args.kernel} theme={lightTheme} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Browser truth (contract §7 row 12): an inspector edit changes the REAL
    // canvas text. Idempotent: asserts against the document's CURRENT title.
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'title' }), '!');
    const title = canvasKernel.getDocument().nodes['c1']?.props['title'];
    const expected = typeof title === 'string' ? title : '';
    await expect(expected.endsWith('!')).toBe(true);
    const frame = canvasElement.querySelector('iframe');
    await waitFor(async () => {
      await expect(frame?.contentDocument?.body.textContent ?? '').toContain(expected);
    });
  },
};

const colorRoleCanvasKernel = makeKernel();
export const ColorRolePaletteReflectsToCanvas: Story = {
  args: { kernel: colorRoleCanvasKernel },
  render: (args) => (
    <div style={{ blockSize: 'var(--bldr-dock-min-height)', display: 'flex' }}>
      <Inspector kernel={args.kernel} theme={args.theme} />
      <div style={{ flex: 1, minInlineSize: 'var(--bldr-space-0)' }}>
        <EditorCanvas kernel={args.kernel} theme={args.theme ?? lightTheme} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Mutations guarded here: paint a swatch with the wrong `entry.value`, overflow the
    // token-sized group, commit a palette value/twice, or stop CardRender consuming the selected
    // role's cssVar. Each breaks a distinct assertion in this named Chromium story.
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Design' }));
    const inspector = canvas.getByRole('region', { name: 'Inspector' });
    const group = canvas.getByRole('radiogroup', { name: 'paint' });
    const surface = within(group).getByRole('radio', { name: 'Surface' });
    const accent = within(group).getByRole('radio', { name: 'Accent' });
    if (surface.getAttribute('aria-checked') !== 'true') {
      await userEvent.click(surface);
    }
    await waitFor(async () => {
      await expect(colorRoleCanvasKernel.getDocument().nodes['c1']?.props['paint']).toBe('surface');
    });

    const frame = canvasElement.querySelector<HTMLIFrameElement>('iframe');
    await waitFor(async () => {
      await expect(
        frame?.contentDocument?.querySelector('[data-testid="inspector-story-card"]') ?? null,
      ).not.toBeNull();
    });
    const renderedBlock = frame?.contentDocument?.querySelector<HTMLElement>(
      '[data-testid="inspector-story-card"]',
    );
    const surfaceSwatch = canvasElement.querySelector<HTMLElement>(
      '[data-color-role-swatch="surface"]',
    );
    const accentSwatch = canvasElement.querySelector<HTMLElement>(
      '[data-color-role-swatch="accent"]',
    );
    if (renderedBlock === null || renderedBlock === undefined) {
      throw new Error('The measured role-aware block was not rendered in the canvas frame.');
    }
    if (surfaceSwatch === null || accentSwatch === null) {
      throw new Error('The measured palette swatches were not rendered.');
    }

    const inspectorRect = inspector.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();
    const options = within(group).getAllByRole('radio');
    await expect(
      Number.parseFloat(getComputedStyle(inspector).getPropertyValue('--bldr-inspector-width')),
    ).toBe(312);
    await expect(inspectorRect.width).toBeGreaterThan(0);
    await expect(Math.abs(inspectorRect.width - 312)).toBeLessThanOrEqual(0.5);
    await expect(groupRect.width).toBeGreaterThan(0);
    await expect(groupRect.left).toBeGreaterThanOrEqual(inspectorRect.left - 0.5);
    await expect(groupRect.right).toBeLessThanOrEqual(inspectorRect.right + 0.5);
    await expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth + 1);
    await expect(options).toHaveLength(STORY_PALETTE.length);
    for (const option of options) {
      const rect = option.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.left).toBeGreaterThanOrEqual(groupRect.left - 0.5);
      await expect(rect.right).toBeLessThanOrEqual(groupRect.right + 0.5);
    }

    for (const entry of STORY_PALETTE) {
      const swatch = canvasElement.querySelector<HTMLElement>(
        `[data-color-role-swatch="${entry.role}"]`,
      );
      if (swatch === null) {
        throw new Error(`The ${entry.name} swatch was not rendered.`);
      }
      const expected = document.createElement('span');
      expected.style.backgroundColor = entry.value;
      await expect(getComputedStyle(swatch).backgroundColor).toBe(expected.style.backgroundColor);
      await expect(getComputedStyle(swatch).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    }
    const surfaceColor = getComputedStyle(surfaceSwatch).backgroundColor;
    const accentColor = getComputedStyle(accentSwatch).backgroundColor;
    await expect(accentColor).not.toBe(surfaceColor);
    await expect(getComputedStyle(renderedBlock).backgroundColor).toBe(surfaceColor);

    const before = colorRoleCanvasKernel.transactions().length;
    await userEvent.click(accent);
    await expect(
      colorRoleCanvasKernel
        .transactions()
        .slice(before)
        .map((tx) => tx.command),
    ).toEqual(['setProp']);
    await expect(colorRoleCanvasKernel.getDocument().nodes['c1']?.props['paint']).toBe('accent');
    await expect(colorRoleCanvasKernel.getDocument().nodes['c1']?.props['paint']).not.toBe(
      STORY_PALETTE.find((entry) => entry.role === 'accent')?.value,
    );
    await waitFor(async () => {
      await expect(getComputedStyle(renderedBlock).backgroundColor).toBe(accentColor);
    });
    await expect(getComputedStyle(renderedBlock).backgroundColor).not.toBe(surfaceColor);
  },
};
