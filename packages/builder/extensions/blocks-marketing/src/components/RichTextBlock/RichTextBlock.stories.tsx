import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { RichTextBlock } from './RichTextBlock';
import type { RichTextBlockProps } from './schema';

const props = (content: unknown): BlockRenderProps<RichTextBlockProps> => ({
  node: { id: 'r1', type: 'richText', props: { content: content as never } },
  props: { content },
  slots: {},
  data: {},
  isCanvas: false,
});

const CONTENT = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'About us' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'We build ' },
        { type: 'text', text: 'reliable', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'fast', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' tools for the web.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Open contracts' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Proven laws' }] }],
        },
      ],
    },
  ],
};

const meta = {
  title: 'Builder/Blocks/RichTextBlock',
  component: RichTextBlock,
} satisfies Meta<typeof RichTextBlock>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: props(CONTENT),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('About us');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const RightToLeft: Story = {
  args: props({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'من نحن' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'نبني أدوات ' },
          { type: 'text', text: 'موثوقة', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' للويب.' },
        ],
      },
    ],
  }),
  globals: { direction: 'rtl' },
};
