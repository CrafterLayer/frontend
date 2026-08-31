import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { SpotlightSurface } from './SpotlightSurface';
import { spotlightSurfaceSchema } from './schema';

const node: Node = { id: 'spotlight-story', type: 'spotlightSurface', props: {} };

const content = (
  <div style={{ margin: '0 auto', maxWidth: 800, padding: '96px 24px', textAlign: 'center' }}>
    <p>Designed for consequential launches</p>
    <h2 style={{ fontSize: 52, margin: 0 }}>A focused surface for the message that matters</h2>
  </div>
);

const meta = {
  title: 'Builder/Aceternity/SpotlightSurface',
  component: SpotlightSurface,
  args: {
    node,
    props: spotlightSurfaceSchema.props.parse({ minHeight: 'compact' }),
    slots: { default: content },
    data: {},
    isCanvas: false,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SpotlightSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Soft: Story = {};

export const Focused: Story = {
  args: {
    props: spotlightSurfaceSchema.props.parse({
      variant: 'focused',
      position: 'start',
      intensity: 'strong',
      minHeight: 'compact',
    }),
  },
};

export const DualLight: Story = {
  args: {
    props: spotlightSurfaceSchema.props.parse({
      variant: 'dual',
      tone: 'light',
      intensity: 'subtle',
      minHeight: 'compact',
    }),
  },
};
