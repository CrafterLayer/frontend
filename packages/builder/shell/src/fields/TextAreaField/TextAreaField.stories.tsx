import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';

import { TextAreaField } from './TextAreaField';

function Harness({ initial, label }: { initial: string; label: string }) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <label style={{ display: 'grid', gap: '0.25rem', maxInlineSize: '18rem' }}>
      {label}
      <TextAreaField
        schema={z.string()}
        value={value}
        path={['props', 'body']}
        onChange={setValue}
      />
    </label>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/TextAreaField',
  component: TextAreaField,
  args: { schema: z.string(), value: '', path: ['props', 'body'], onChange: () => undefined },
} satisfies Meta<typeof TextAreaField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Paragraph: Story = {
  render: () => (
    <Harness
      label="Body"
      initial="Build a site that grows with you, from premium blocks. Every edit becomes one undoable step."
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('textbox', { name: 'Body' });
    await expect(box).toHaveAttribute('dir', 'auto');
    await userEvent.type(box, ' More.');
    await expect(box).toHaveValue(
      'Build a site that grows with you, from premium blocks. Every edit becomes one undoable step. More.',
    );
  },
};

export const MixedDirection: Story = {
  render: () => (
    <div dir="rtl" style={{ display: 'grid', gap: '0.75rem' }}>
      <Harness label="النص" initial="ابنِ موقعك من كتل جاهزة." />
      <Harness label="English on an Arabic page" initial="The site grows." />
    </div>
  ),
  globals: { direction: 'rtl' },
};
