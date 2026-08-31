import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Carousel } from './Carousel';
import { carouselExamples } from './examples';
import { carouselSchema } from './schema';

const node: Node = { id: 'carousel-story', type: 'carousel', props: {} };
const exampleProps = (index: number) =>
  carouselSchema.props.parse((carouselExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Carousel',
  component: Carousel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductTour: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Turn a rough brief into an executable plan' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Next slide' }));
    await expect(
      canvas.getByRole('heading', { name: 'Keep decisions close to the work' }),
    ).toBeVisible();
  },
};

export const ArabicMediaRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'carousel-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const AutoplayWithPause: Story = {
  args: {
    ...ProductTour.args,
    node: { ...node, id: 'carousel-autoplay' },
    props: carouselSchema.props.parse({
      ...(carouselExamples[0]?.node as { props: Record<string, unknown> }).props,
      autoplay: true,
      autoplayInterval: 'slow',
    }),
  },
};

export const EmptyCanvas: Story = {
  args: {
    node: { ...node, id: 'carousel-empty' },
    props: carouselSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};
