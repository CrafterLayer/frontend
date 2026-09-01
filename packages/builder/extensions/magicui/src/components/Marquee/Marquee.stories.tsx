import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { Marquee } from './Marquee';
import { marqueeSchema } from './schema';

const node: Node = { id: 'marquee-story', type: 'marquee', props: {} };

const meta = {
  title: 'Builder/MagicUI/Marquee',
  component: Marquee,
  args: {
    node,
    props: marqueeSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Marquee>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Logos: Story = {};

export const Cards: Story = {
  args: {
    props: marqueeSchema.props.parse({
      label: 'Customer stories',
      items: [
        { title: 'Mira', description: 'The launch finally felt inevitable.', meta: 'Founder' },
        { title: 'Jon', description: 'Every screen now earns its place.', meta: 'Product' },
        { title: 'Noor', description: 'Clear decisions, beautifully executed.', meta: 'Design' },
      ],
      presentation: 'cards',
      tone: 'surface',
      rows: 'two',
    }),
  },
};

export const CompactReverse: Story = {
  args: {
    props: marqueeSchema.props.parse({
      presentation: 'compact',
      direction: 'reverse',
      speed: 'fast',
      edgeFade: false,
    }),
  },
};

export const ManualPause: Story = {
  args: {
    props: marqueeSchema.props.parse({
      pauseOnHover: false,
      pauseLabel: 'Pause partner movement',
      resumeLabel: 'Resume partner movement',
    }),
  },
};
