import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Marquee } from './Marquee';
import { marqueeExamples } from './examples';
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

/* Block parts (DESIGN §4.4): every item line, image and link is a part on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'marquee-parts' },
    props: marqueeSchema.props.parse({
      ...(marqueeExamples[2]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'item.meta': { className: 'text-accent' },
        'item.title@0': { className: 'underline' },
      },
    }),
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const links = canvasElement.querySelectorAll('[data-ck-part="item.link"]');
    await expect(links).toHaveLength(3);
    await expect(links[0]).toHaveAttribute('data-ck-bind', 'items.0.title');
    await expect(canvasElement.querySelector('[data-ck-part="item.meta"]')).toHaveClass(
      'text-accent',
    );
    await expect(canvasElement.querySelector('[data-ck-part="item.title"]')).toHaveClass(
      'underline',
    );
  },
};
