import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { processStepsExamples } from './examples';
import { ProcessSteps } from './ProcessSteps';
import { processStepsSchema } from './schema';

const node: Node = { id: 'process-story', type: 'processSteps', props: {} };
const exampleProps = (index: number) =>
  processStepsSchema.props.parse((processStepsExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Process Steps',
  component: ProcessSteps,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ProcessSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: processStepsSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(4);
  },
};

export const StudioWorkflow: Story = {
  args: { ...Default.args, props: exampleProps(0) },
};

export const AccentedWithoutNumbers: Story = {
  args: {
    ...Default.args,
    props: processStepsSchema.props.parse({ variant: 'accented', showNumbers: false }),
  },
};

export const Empty: Story = {
  args: { ...Default.args, props: processStepsSchema.props.parse({ steps: [] }) },
};

export const ArabicVerticalRtl: Story = {
  globals: { direction: 'rtl' },
  args: { ...Default.args, props: exampleProps(1) },
};
