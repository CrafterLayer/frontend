import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleApplyResult } from '../style-source';
import { ElementCodeEditor } from './ElementCodeEditor';

const meta = {
  title: 'Builder/Shell/StyleManager/ElementCodeEditor',
  component: ElementCodeEditor,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '22rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    element: {
      kind: 'element',
      tag: 'a',
      className: 'inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-accent-text',
      text: 'Book a call',
      attributes: { href: '/contact' },
    },
    onCommit: fn((): StyleApplyResult => ({ ok: true })),
    onOpenRegionCss: fn(),
    onOpenPageCss: fn(),
  },
} satisfies Meta<typeof ElementCodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Link: Story = {};
export const WithChildren: Story = {
  args: {
    element: {
      kind: 'element',
      tag: 'section',
      className: 'grid gap-8',
      children: [{ kind: 'element', tag: 'h2', text: 'Inside' }],
    },
  },
};
export const Refused: Story = {
  args: {
    onCommit: fn((): StyleApplyResult => ({ ok: false, message: 'href must be https, mailto, tel or a page path' })),
  },
};
