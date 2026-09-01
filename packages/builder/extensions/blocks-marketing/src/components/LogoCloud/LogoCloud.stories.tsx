import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { logoCloudExamples } from './examples';
import { LogoCloud } from './LogoCloud';
import { logoCloudSchema } from './schema';

const node: Node = { id: 'logo-cloud-story', type: 'logoCloud', props: {} };
const exampleProps = (index: number) =>
  logoCloudSchema.props.parse((logoCloudExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Logo Cloud',
  component: LogoCloud,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LogoCloud>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: logoCloudSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(6);
  },
};

export const PremiumCards: Story = {
  args: { ...Default.args, props: exampleProps(0) },
};

export const FramedBand: Story = {
  args: {
    ...Default.args,
    props: logoCloudSchema.props.parse({ variant: 'framed', columns: '6', tone: 'transparent' }),
  },
};

export const Empty: Story = {
  args: { ...Default.args, props: logoCloudSchema.props.parse({ items: [] }) },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { ...Default.args, props: exampleProps(1) },
};
