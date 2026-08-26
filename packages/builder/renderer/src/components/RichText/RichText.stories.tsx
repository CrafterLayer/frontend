import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RichText } from './RichText';

const FIXTURE = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rich text' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Body with ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' and ' },
        {
          type: 'text',
          text: 'a safe link',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First point' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second point' }] }],
        },
      ],
    },
  ],
};

const meta = {
  title: 'Builder/Renderer/RichText',
  component: RichText,
} satisfies Meta<typeof RichText>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Whitelist: Story = {
  args: { value: FIXTURE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Rich text');
    await expect(canvas.getByRole('link', { name: 'a safe link' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const NeutralizedLink: Story = {
  args: {
    value: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'hostile link becomes plain text',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('link')).not.toBeInTheDocument();
    await expect(canvasElement).toHaveTextContent('hostile link becomes plain text');
  },
};

export const RightToLeft: Story = {
  args: {
    value: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'عنوان غني' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'نص عربي مع ' },
            { type: 'text', text: 'توكيد', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    },
  },
  globals: { direction: 'rtl' },
};
