import type { Meta, StoryObj } from '@storybook/react-vite';
import { z } from 'zod';

import type { RepeaterFieldProps } from './types';
import { RepeaterField } from './RepeaterField';
import '../Inspector.css';
import '../InspectorRow.css';

const itemSchema = z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }));
const boundedSchema = itemSchema.min(1).max(2);

const renderRow: RepeaterFieldProps['renderRow'] = (row) => (
  <input
    className="bldr-field__input"
    aria-label={row.propKey}
    value={typeof row.value === 'string' || typeof row.value === 'number' ? String(row.value) : ''}
    readOnly
  />
);

const meta = {
  title: 'Builder/Shell/Inspector/RepeaterField',
  component: RepeaterField,
  decorators: [
    // The container decides the panel's width (R12); the story is that container.
    (Story) => (
      <section
        className="bldr-inspector"
        aria-label="Repeater story frame"
        style={{ inlineSize: 'var(--bldr-inspector-width)', padding: 'var(--bldr-panel-padding)' }}
      >
        <Story />
      </section>
    ),
  ],
  args: {
    path: ['props', 'items'],
    commit: () => ({ ok: true }),
    announce: () => undefined,
    renderRow,
  },
} satisfies Meta<typeof RepeaterField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    schema: itemSchema,
    value: [
      { title: 'Fast setup', body: 'Start in minutes.' },
      { title: 'Flexible design', body: 'Shape every section.' },
    ],
  },
};

export const Empty: Story = {
  args: { schema: itemSchema, value: [] },
};

export const AtMaximum: Story = {
  args: {
    schema: boundedSchema,
    value: [
      { title: 'Starter', body: 'For small teams.' },
      { title: 'Growth', body: 'For growing teams.' },
    ],
  },
};

export const AtMinimum: Story = {
  args: {
    schema: boundedSchema,
    value: [{ title: 'Required item', body: 'The only item cannot be removed.' }],
  },
};
