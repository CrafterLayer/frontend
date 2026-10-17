import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { AnnouncementBar } from './AnnouncementBar';
import { announcementBarExamples } from './examples';
import { announcementBarSchema } from './schema';

const node: Node = { id: 'announcement-story', type: 'announcementBar', props: {} };
const exampleProps = (index: number) =>
  announcementBarSchema.props.parse(
    (announcementBarExamples[index]?.node as { props: unknown }).props,
  );

const meta = {
  title: 'Builder/Blocks/Announcement Bar',
  component: AnnouncementBar,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AnnouncementBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: announcementBarSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: /Explore the release/ })).toBeVisible();
  },
};

export const ProductRelease: Story = {
  args: { ...Default.args, props: exampleProps(0) },
};

export const SubtleWithoutLink: Story = {
  args: {
    ...Default.args,
    props: announcementBarSchema.props.parse({
      label: 'Maintenance',
      message: 'Scheduled maintenance starts Sunday at 02:00 UTC.',
      showLink: false,
      emphasis: 'subtle',
      tone: 'light',
    }),
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { ...Default.args, props: exampleProps(1) },
};

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'announcementBar-parts', type: 'announcementBar', props: {} },
    props: announcementBarSchema.props.parse({
      message: 'Version 2 is live.',
      linkLabel: 'Read more',
      href: '/changelog',
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ck-part="message"]')).toHaveAttribute(
      'data-ck-bind',
      'message',
    );
  },
};
