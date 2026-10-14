import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { logoCloudExamples } from './examples';
import { LogoCloud } from './LogoCloud';
import { logoCloudSchema } from './schema';

const node: Node = { id: 'logo-cloud-story', type: 'logoCloud', props: {} };
const exampleProps = (index: number) =>
  logoCloudSchema.props.parse((logoCloudExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Logo Cloud',
  component: LogoCloud,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LogoCloud>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: logoCloudSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(6);
  },
};

export const PremiumCards: Story = {
  args: { ...Default.args, props: exampleProps(0) },
};

export const FramedBand: Story = {
  args: {
    ...Default.args,
    props: logoCloudSchema.props.parse({ variant: 'framed', columns: '6', tone: 'transparent' }),
  },
};

/*
  Brands with logo images. The agent writes Simple Icons addresses for brands the person names;
  the story uses inline raster marks so it renders without the network.
*/
const MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export const WithLogos: Story = {
  args: {
    ...Default.args,
    props: logoCloudSchema.props.parse({
      heading: 'Pay the way you already do',
      columns: '4',
      items: [
        { name: 'Visa', descriptor: 'Cards', logo: MARK },
        { name: 'Mastercard', descriptor: 'Cards', logo: MARK },
        { name: 'Apple Pay', descriptor: 'Wallet', logo: MARK },
        { name: 'Northstar', descriptor: 'No logo yet' },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-logo-cloud-logo]')).toHaveLength(3);
    await expect(within(canvasElement).getByText('Northstar')).toBeVisible();
  },
};

export const Empty: Story = {
  args: { ...Default.args, props: logoCloudSchema.props.parse({ items: [] }) },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { ...Default.args, props: exampleProps(1) },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...logoCloudSchema.props.parse({
        eyebrow: 'Trusted',
        heading: 'Teams build with us.',
        body: 'From startups to agencies.',
        items: [{ name: 'North Star', descriptor: 'Fintech' }, { name: 'Atlas' }],
      }),
      partStyles: {
        'item.name': { className: 'text-accent' },
        'item.name@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="item.name"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'items.0.name');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="items"]')).toHaveAttribute(
      'data-ck-bind',
      'items',
    );
  },
};
