import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Fundraiser } from './Fundraiser';
import { fundraiserExamples } from './examples';
import { fundraiserSchema } from './schema';

const node: Node = { id: 'fundraiser-story', type: 'fundraiser', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  fundraiserSchema.props.parse({
    ...(fundraiserExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof fundraiserSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/Fundraiser',
  component: Fundraiser,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Fundraiser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SchoolLibrary: Story = {
  args: story('fundraiser-library', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('progressbar', { name: 'Funding progress' })).toHaveAttribute(
      'aria-valuenow',
      '68',
    );
    await expect(canvas.getByRole('link', { name: '$50' })).toBeVisible();
  },
};

/* RTL with Arabic-Indic digits: the bar grows from the right, the currency follows the number. */
export const ArabicWell: Story = {
  globals: { direction: 'rtl' },
  args: story('fundraiser-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('progressbar', { name: 'نسبة الإنجاز' }),
    ).toBeVisible();
  },
};

export const DarkSection: Story = {
  args: story('fundraiser-dark', exampleProps(1, { tone: 'dark' })),
  globals: { direction: 'rtl' },
};

/* The library card: what a person sees the moment they insert one. */
export const LibraryDefault: Story = {
  args: story('fundraiser-default', fundraiserSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): the currency beside both amounts is one part. */
export const Parts: Story = {
  args: story(
    'fundraiser-parts',
    exampleProps(0, { partStyles: { currency: { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const currencies = canvasElement.querySelectorAll('[data-ck-part="currency"]');
    await expect(currencies).toHaveLength(2);
    await expect(currencies[0]).toHaveClass('text-accent');
  },
};

/* A 390px column: the photo above the card, the amount line wrapping between units. */
export const Mobile: Story = {
  args: story('fundraiser-mobile', exampleProps(0)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
