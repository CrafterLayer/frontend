import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { FieldServicesProvider } from '../field-services';
import { RichTextFieldSkeleton } from './RichTextFieldSkeleton';

const DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it holds' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Every edit is ' },
        { type: 'text', text: 'one transaction', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' through a validated door.' },
      ],
    },
  ],
};

const meta = {
  title: 'Builder/Shell/Fields/RichTextFieldSkeleton',
  component: RichTextFieldSkeleton,
  args: { value: DOC, state: 'loading', controlId: 'content' },
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: '18rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RichTextFieldSkeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = canvas.getByRole('textbox');
    await expect(surface).toBeDisabled();
    await expect((surface as HTMLTextAreaElement).value).not.toContain('{');
  },
};

export const Failed: Story = {
  args: { state: 'failed', onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

export const Arabic: Story = {
  args: {
    state: 'failed',
    onRetry: fn(),
    value: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'كل تعديل خطوة واحدة.' }] }],
    },
  },
  render: (args) => (
    <FieldServicesProvider value={{ locale: 'ar' }}>
      <div dir="rtl">
        <RichTextFieldSkeleton {...args} />
      </div>
    </FieldServicesProvider>
  ),
  globals: { direction: 'rtl' },
};
