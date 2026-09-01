import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { videoSectionExamples } from './examples';
import { videoSectionSchema } from './schema';
import { VideoSection } from './VideoSection';

const node: Node = { id: 'video-section-story', type: 'videoSection', props: {} };
const exampleProps = (index: number) =>
  videoSectionSchema.props.parse((videoSectionExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Video Section',
  component: VideoSection,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof VideoSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Split: Story = {
  args: {
    node,
    props: exampleProps(0),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ args, canvasElement }) => {
    /*
      Asserted against the rendered example's OWN text, not a remembered
      string: the examples were rewritten and this play kept quoting the old
      copy ("Watch a rough brief"), so the story failed on every Chromium run
      while the component was right — a `<section>` is named by its heading,
      and the video by its label.
    */
    const canvas = within(canvasElement);
    const { heading, videoLabel } = args.props;
    await expect(canvas.getByRole('region', { name: heading })).toBeVisible();
    await expect(canvas.getByLabelText(videoLabel ?? heading)).toHaveAttribute('controls');
  },
};

export const Centered: Story = {
  args: {
    ...Split.args,
    node: { ...node, id: 'video-section-centered' },
    props: videoSectionSchema.props.parse({
      ...(videoSectionExamples[0]?.node as { props: Record<string, unknown> }).props,
      layout: 'centered',
      align: 'center',
    }),
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Split.args,
    node: { ...node, id: 'video-section-arabic' },
    props: exampleProps(1),
  },
};

export const EmptyCanvas: Story = {
  args: {
    ...Split.args,
    node: { ...node, id: 'video-section-empty' },
    props: videoSectionSchema.props.parse({}),
    isCanvas: true,
  },
};
