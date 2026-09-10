import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { CodeEditor } from './CodeEditor';

const TSX_SOURCE = `import { Button } from '@craftkit/ui';

export default function Hero() {
  return <Button>Start building</Button>;
}`;

const meta = {
  title: 'Builder/Code view/CodeEditor',
  component: CodeEditor,
  args: {
    value: TSX_SOURCE,
    language: 'tsx',
    label: 'Page source',
    path: 'pages/home/index.tsx',
    completions: [
      { label: 'Button', type: 'class', detail: '@craftkit/ui' },
      { label: 'Card', type: 'class', detail: '@craftkit/ui' },
    ],
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loadModules: () => new Promise(() => undefined),
  },
};

export const Valid: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole('textbox', { name: 'Page source' });
    await userEvent.click(editor);
    await userEvent.keyboard('{Control>}f{/Control}');
    await waitFor(() => expect(editor).toHaveFocus());
  },
};

export const Invalid: Story = {
  args: {
    diagnostics: [
      {
        code: 'tsx/expected-close',
        message: 'Expected a closing JSX tag.',
        severity: 'error',
        modulePath: 'pages/home/index.tsx',
        line: 4,
        column: 9,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: /Expected a closing JSX tag/ }),
    );
    await expect(canvas.getByRole('textbox', { name: 'Page source' })).toHaveFocus();
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true },
};

export const ProposedDiff: Story = {
  args: {
    value: TSX_SOURCE.replace('Start building', 'Launch today'),
    diff: {
      original: TSX_SOURCE,
      label: '1 proposed source edit',
      onApprove: () => undefined,
      onReject: () => undefined,
    },
  },
};
