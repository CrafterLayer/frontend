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

import { lightTheme } from '@craftkit/builder-renderer';

import { EditorCanvas } from '../EditorCanvas';
import { Inspector } from './Inspector';

const SlotRender = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;
const CardRender = ((props: { props: { title?: string; badge?: string } }) => (
  <article style={{ font: '16px system-ui', padding: '1rem' }}>
    {props.props.title ?? ''} <small>{props.props.badge ?? ''}</small>
  </article>
)) as unknown as BlockRenderComponent;

const CARD_PROPS = z.object({
  // title is UNBOUNDED so the EditProps play stays rerun-idempotent forever;
  // badge carries the constraint the Rejection play needs.
  title: z.string().default('Card title'),
  badge: z.string().max(5).default('New'),
  tone: z.enum(['light', 'dark']).default('light'),
  featured: z.boolean().default(false),
  columns: z.number().default(2),
});

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
      props: { title: 'Launch hero', badge: 'New', tone: 'dark', featured: true, columns: 3 },
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

const meta = {
  title: 'Builder/Shell/Inspector',
  component: Inspector,
} satisfies Meta<typeof Inspector>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { kernel: makeKernel('ltr', false) },
};

export const Selected: Story = {
  args: { kernel: makeKernel() },
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

// A REALISTIC contributed field: it consumes only the public FieldProps and
// ignores the shell extras — the row's structural label must still name it
// (review H2; this story is what puts that path under the catalog a11y gate).
const BadgePicker = ({ value, onChange }: FieldProps) => (
  <div style={{ display: 'flex', gap: '0.25rem' }}>
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
    <div style={{ blockSize: 480, display: 'flex' }}>
      <Inspector kernel={args.kernel} />
      <div style={{ flex: 1, minInlineSize: 0 }}>
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
