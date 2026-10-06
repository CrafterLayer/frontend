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

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...processStepsSchema.props.parse({
        eyebrow: 'How it works',
        heading: 'A clear path to launch.',
        body: 'Each stage has an outcome.',
        steps: [
          { title: 'Discover', body: 'We map the work.', meta: 'Week 1' },
          { title: 'Build', body: 'We ship the pages.' },
        ],
      }),
      partStyles: {
        'step.title': { className: 'text-accent' },
        'step.title@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="step.title"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'steps.0.title');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="steps"]')).toHaveAttribute(
      'data-ck-bind',
      'steps',
    );
  },
};
