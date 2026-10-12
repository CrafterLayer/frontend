import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Location } from './Location';
import { locationExamples } from './examples';
import { locationSchema } from './schema';

const node: Node = { id: 'location-story', type: 'location', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  locationSchema.props.parse({
    ...(locationExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof locationSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/Location',
  component: Location,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Location>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArabicCafe: Story = {
  globals: { direction: 'rtl' },
  args: story('location-arabic', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: /اطلب عبر واتساب/u })).toHaveAttribute(
      'href',
      'https://wa.me/966501234567?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.',
    );
    await expect(canvas.getByRole('link', { name: 'افتح في الخرائط' })).toBeVisible();
  },
};

/* Without the embed: the clinic's pin opens OpenStreetMap; nothing third-party loads. */
export const ClinicWithPin: Story = {
  args: story('location-clinic', exampleProps(1, { embedMap: false })),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(within(canvasElement).getByRole('link', { name: 'Open in Maps' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=50.7989&mlon=-1.0912#map=17/50.7989/-1.0912',
    );
  },
};

export const StackedShop: Story = {
  args: story('location-shop', exampleProps(2)),
};

/* The library card: an address, three rows of hours, the maps button. */
export const LibraryDefault: Story = {
  args: story('location-default', locationSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): the address, each hours row and each contact value are parts on the canvas. */
export const Parts: Story = {
  args: story(
    'location-parts',
    exampleProps(0, { partStyles: { 'hour.time': { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const times = canvasElement.querySelectorAll('[data-ck-part="hour.time"]');
    await expect(times[1]).toHaveAttribute('data-ck-bind', 'hours.1.time');
    await expect(times[1]).toHaveClass('text-accent');
  },
};

export const Mobile: Story = {
  args: story('location-mobile', exampleProps(1, { embedMap: false })),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
