import { createRef, useRef } from 'react';

import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CodeViewErrors, type CodeViewErrorsProps } from './CodeViewErrors';

const source = '{\n  "nodes": {},\n  "rootId": "root"\n}';

function CodeViewErrorsStorySurface(props: CodeViewErrorsProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div>
      <textarea ref={textareaRef} aria-label="Story document code" value={props.source} readOnly />
      <CodeViewErrors {...props} textareaRef={textareaRef} />
    </div>
  );
}

const meta = {
  title: 'Builder/Extensions/CodeViewErrors',
  component: CodeViewErrors,
  args: {
    source,
    textareaRef: createRef<HTMLTextAreaElement>(),
    announcementNonce: 1,
  },
  render: (args) => <CodeViewErrorsStorySurface {...args} />,
} satisfies Meta<typeof CodeViewErrors>;
export default meta;

type Story = StoryObj<typeof meta>;

export const None: Story = {
  args: { errors: [], announcement: 'Code is valid.' },
};

export const One: Story = {
  args: {
    errors: [{ line: 2, message: 'Expected a property name.' }],
    announcement: '1 code error found.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox', { name: 'Story document code' });
    await userEvent.click(canvas.getByRole('button', { name: /Line 2:/ }));
    await expect(textarea).toHaveFocus();
    await expect(textarea).toHaveProperty('selectionStart', 2);
    await expect(textarea).toHaveProperty('selectionEnd', 16);
  },
};

export const Many: Story = {
  args: {
    errors: [
      { line: 2, message: 'Expected a property name.' },
      { line: 3, message: 'Node "ghost" uses an unregistered block type.' },
      { line: 4, message: 'Expected a closing brace.' },
    ],
    announcement: '3 code errors found.',
  },
};

export const RightToLeft: Story = {
  args: {
    errors: [
      { line: 2, message: 'اسم الخاصية غير صالح.' },
      { line: 3, message: 'نوع المكوّن غير مسجل.' },
    ],
    announcement: 'تم العثور على خطأين في الشفرة.',
  },
  render: (args) => (
    <div dir="rtl">
      <CodeViewErrorsStorySurface {...args} />
    </div>
  ),
  globals: { direction: 'rtl' },
};
