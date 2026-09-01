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
