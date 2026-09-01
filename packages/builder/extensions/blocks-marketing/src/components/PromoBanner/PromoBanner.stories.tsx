import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PromoBanner } from './PromoBanner';
import { promoBannerExamples } from './examples';
import { promoBannerSchema } from './schema';

const node: Node = { id: 'promo-story', type: 'promoBanner', props: {} };
const exampleProps = (index: number) =>
  promoBannerSchema.props.parse((promoBannerExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Promo Banner',
  component: PromoBanner,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PromoBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductLaunch: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Start free' })).toBeVisible();
    await expect(canvas.getByRole('img')).toBeVisible();
  },
};

export const ArabicMediaRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'promo-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const CenteredAccent: Story = {
  args: {
    node: { ...node, id: 'promo-centered' },
    props: promoBannerSchema.props.parse({
      label: '48 hours only',
      headline: 'Bring the whole team, without the enterprise wait',
      body: 'Upgrade this week and invite every collaborator at no extra cost for three months.',
      actions: [
        { label: 'Claim the offer', href: '/upgrade', emphasis: 'primary' },
        { label: 'Compare plans', href: '/pricing', emphasis: 'secondary' },
      ],
      variant: 'centered',
      panelStyle: 'accent',
      align: 'center',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const CompactSurface: Story = {
  args: {
    node: { ...node, id: 'promo-compact' },
    props: promoBannerSchema.props.parse({
      headline: 'Free shipping through Friday',
      actions: [{ label: 'Shop the collection', href: '/shop' }],
      panelStyle: 'surface',
      padding: 'compact',
      radius: 'lg',
      width: 'standard',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
