import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { MenuSection } from './MenuSection';
import { menuSectionExamples } from './examples';
import { menuSectionSchema } from './schema';

const node: Node = { id: 'menuSection-story', type: 'menuSection', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  menuSectionSchema.props.parse({
    ...(menuSectionExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof menuSectionSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/Menu Section',
  component: MenuSection,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MenuSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/* A 16px warm swatch: a raster data URL, as the schema requires of a menu photo. */
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4dngpSYhhVMOohuGrAQBXkT4fX+WQeAAAAABJRU5ErkJggg==';

export const ArabicGrillMenu: Story = {
  globals: { direction: 'rtl' },
  args: story('menu-arabic', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 3, name: 'المشاوي' })).toBeVisible();
    const price = canvasElement.querySelector('[data-menu-price]');
    await expect(price?.textContent).toBe('٤٢\u00A0ر.س');
  },
};

export const CafeDrinks: Story = {
  args: story('menu-cafe', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll('[data-menu-leader="dotted"]').length,
    ).toBeGreaterThan(0);
  },
};

export const ServicesPriceList: Story = {
  args: story('menu-services', exampleProps(2)),
};

export const WithPhotos: Story = {
  args: story(
    'menu-photos',
    menuSectionSchema.props.parse({
      heading: 'Today’s specials',
      currency: '€',
      currencyPosition: 'after',
      columns: '1',
      width: 'standard',
      categories: [
        {
          name: 'Specials',
          items: [
            {
              name: 'Grilled halloumi',
              description: 'Watermelon, mint, pistachio.',
              price: '11.50',
              tags: ['Vegetarian'],
              imageSrc: PHOTO,
              imageAlt: 'Grilled halloumi on a plate',
            },
            {
              name: 'Lamb ouzi',
              description: 'Spiced rice, almonds, yoghurt.',
              price: '24.00',
              tags: ['Signature'],
              imageSrc: PHOTO,
              imageAlt: 'Lamb on spiced rice',
            },
          ],
        },
      ],
    }),
  ),
};

/* The library card: what a person sees the moment they insert a Menu. */
export const LibraryDefault: Story = {
  args: story('menu-default', menuSectionSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every dish's name, price and tags are parts, addressed by category and position. */
export const Parts: Story = {
  args: story(
    'menu-parts',
    exampleProps(1, { partStyles: { 'dish.price': { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const prices = canvasElement.querySelectorAll('[data-ck-part="dish.price"]');
    await expect(prices[3]).toHaveAttribute('data-ck-bind', 'categories.1.items.0.price');
    await expect(prices[3]).toHaveClass('text-accent');
  },
};

export const Mobile: Story = {
  globals: { direction: 'rtl' },
  args: story('menu-mobile', exampleProps(0)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
