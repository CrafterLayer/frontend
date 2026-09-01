import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { AuroraBackground } from './AuroraBackground';
import { auroraBackgroundSchema } from './schema';

const node: Node = { id: 'aurora', type: 'auroraBackground', props: {} };

const content = (
  <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
    <h1 style={{ margin: 0, fontSize: '2rem' }}>Build pages your kernel can prove</h1>
    <p style={{ marginBlockStart: '0.5rem' }}>Every edit is one transaction.</p>
  </div>
);

const meta = {
  title: 'Builder/Aceternity/AuroraBackground',
  component: AuroraBackground,
  tags: ['autodocs'],
  args: { node, slots: { default: content }, data: {}, isCanvas: false },
} satisfies Meta<typeof AuroraBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a drifting gradient at normal strength. */
export const Default: Story = {
  args: { props: auroraBackgroundSchema.props.parse({}) },
};

/** Barely there — a tint rather than an effect. */
export const Subtle: Story = {
  args: { props: auroraBackgroundSchema.props.parse({ intensity: 'subtle' }) },
};

/** Turned up, for a page whose hero is the whole message. */
export const Bold: Story = {
  args: { props: auroraBackgroundSchema.props.parse({ intensity: 'bold' }) },
};

/** Still. A page with three moving backgrounds is a page nobody can read. */
export const NoDrift: Story = {
  args: { props: auroraBackgroundSchema.props.parse({ animate: false }) },
};

/** Half the viewport, measured in svh so a phone does not hide the top. */
export const HalfHeight: Story = {
  args: { props: auroraBackgroundSchema.props.parse({ minHeight: 'half' }) },
};

/** Customised from the document with validated Tailwind utilities. */
export const Customised: Story = {
  args: {
    props: auroraBackgroundSchema.props.parse({
      intensity: 'bold',
      minHeight: 'half',
      className: 'rounded-base overflow-hidden',
    }),
  },
};

/** Right-to-left. The mask is directional; the content is not. */
export const RightToLeft: Story = {
  args: { props: auroraBackgroundSchema.props.parse({ minHeight: 'half' }) },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
