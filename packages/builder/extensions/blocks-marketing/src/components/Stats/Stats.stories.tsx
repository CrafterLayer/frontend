import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { statsExamples } from './examples';
import { statsSchema } from './schema';
import { Stats } from './Stats';

const node: Node = { id: 'stats-story', type: 'stats', props: {} };
const exampleProps = (index: number) =>
  statsSchema.props.parse((statsExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Stats',
  component: Stats,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Stats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: statsSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('42%')).toBeVisible();
  },
};

export const StudioOutcomes: Story = {
  args: { ...Default.args, props: exampleProps(0) },
};

export const Minimal: Story = {
  args: {
    ...Default.args,
    props: statsSchema.props.parse({ variant: 'minimal', headerLayout: 'stacked', columns: '4' }),
  },
};

export const Empty: Story = {
  args: { ...Default.args, props: statsSchema.props.parse({ items: [] }) },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { ...Default.args, props: exampleProps(1) },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...statsSchema.props.parse({
        eyebrow: 'Impact',
        heading: 'Results that hold up.',
        body: 'Measured from the first session.',
        items: [
          { value: '98%', label: 'Retention', detail: 'Across all plans.' },
          { value: '2x', label: 'Faster launches' },
        ],
      }),
      partStyles: {
        'item.value': { className: 'text-accent' },
        'item.value@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="item.value"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'items.0.value');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="items"]')).toHaveAttribute(
      'data-ck-bind',
      'items',
    );
  },
};
