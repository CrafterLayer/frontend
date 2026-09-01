import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { ShineBorder } from './ShineBorder';
import { shineBorderSchema } from './schema';

const node: Node = { id: 'shine', type: 'shineBorder', props: {} };

const card = (
  <div style={{ padding: '1.5rem', textAlign: 'center' }}>
    <h3 style={{ margin: 0 }}>Team</h3>
    <p style={{ margin: '0.25rem 0 1rem' }}>$29 per month</p>
    <button type="button">Choose Team</button>
  </div>
);

const meta = {
  title: 'Builder/MagicUI/ShineBorder',
  component: ShineBorder,
  tags: ['autodocs'],
  args: { node, slots: { default: card }, data: {}, isCanvas: false },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '20rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShineBorder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a hairline ring travelling once every fourteen seconds. */
export const Default: Story = {
  args: { props: shineBorderSchema.props.parse({}) },
};

/** Slower. Ambient rather than attention-seeking. */
export const Slow: Story = {
  args: { props: shineBorderSchema.props.parse({ speed: 'slow' }) },
};

/** Heavier ring, still a multiple of the border token. */
export const Heavy: Story = {
  args: { props: shineBorderSchema.props.parse({ weight: 'heavy' }) },
};

/** Still. The ring remains; only the travel stops. */
export const NoTravel: Story = {
  args: { props: shineBorderSchema.props.parse({ animate: false }) },
};

/** Customised from the document with validated Tailwind utilities. */
export const Customised: Story = {
  args: { props: shineBorderSchema.props.parse({ className: 'p-8 bg-surface rounded-base' }) },
};

/** Right-to-left. The ring is symmetrical; the content inside is not. */
export const RightToLeft: Story = {
  args: { props: shineBorderSchema.props.parse({}) },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '20rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
