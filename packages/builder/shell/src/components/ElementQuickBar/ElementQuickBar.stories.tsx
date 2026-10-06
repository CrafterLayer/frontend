import { useMemo, useReducer } from 'react';

import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import {
  createMemoryStyleClipboard,
  performElementAction,
  resolveElementActions,
} from '../../overlay/element-actions';
import { treeKernel } from '../../overlay/tree-test-kit';
import { createElementBarModel } from './element-bar-model';
import { ElementQuickBar } from './ElementQuickBar';
import { ELEMENT_QUICK_BAR_LABELS_AR, ELEMENT_QUICK_BAR_LABELS_EN } from './ElementQuickBar.labels';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'flex flex-col gap-4 p-6 bg-surface rounded-lg',
      children: [
        { kind: 'element', tag: 'h2', className: 'text-3xl font-bold', text: 'Our story' },
        { kind: 'element', tag: 'img', attributes: { src: 'https://example.com/a.jpg', alt: 'Team' } },
        { kind: 'element', tag: 'a', className: 'text-accent', text: 'Read more', attributes: { href: '#more' } },
        { kind: 'icon', name: 'mail' },
      ],
    },
  ],
};

const TOKENS = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'accent', name: 'Accent', css: '#4f46e5' },
];

interface DemoProps {
  readonly path: readonly number[];
  readonly dir: 'ltr' | 'rtl';
  readonly arabic?: boolean;
}

/** A real kernel behind the bar: every control writes a real transaction. */
function Demo({ path, dir, arabic = false }: DemoProps) {
  const kernel = useMemo(() => treeKernel([TREE], dir), [dir]);
  const clipboard = useMemo(() => createMemoryStyleClipboard(), []);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const targets = [{ kind: 'tree' as const, nodeId: 'r1', path: [...path] }];
  const model = createElementBarModel(kernel, targets, { bucket: 'base', state: 'default', pageDir: dir });
  if (model === undefined) return null;
  return (
    <div dir={dir} style={{ padding: 24 }}>
      <ElementQuickBar
        model={model}
        actions={resolveElementActions(kernel, targets, { styleClipboard: clipboard })}
        onAction={(id) => {
          performElementAction(kernel, targets, id, { styleClipboard: clipboard });
          refresh();
        }}
        onMore={() => undefined}
        onEditWithAi={() => undefined}
        onReturnFocus={() => undefined}
        onAnnounce={() => {
          refresh();
        }}
        dir={dir}
        colorTokens={TOKENS}
        labels={arabic ? ELEMENT_QUICK_BAR_LABELS_AR : ELEMENT_QUICK_BAR_LABELS_EN}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/ElementQuickBar',
  component: Demo,
  args: { path: [0, 0], dir: 'ltr' },
} satisfies Meta<typeof Demo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = {
  play: async ({ canvasElement }) => {
    const toolbar = within(canvasElement).getByRole('toolbar');
    const stops = Array.from(toolbar.querySelectorAll<HTMLElement>('[data-bldr-quick-item]')).filter(
      (item) => item.tabIndex === 0,
    );
    await expect(stops).toHaveLength(1);
  },
};

export const Container: Story = { args: { path: [0] } };

export const Image: Story = { args: { path: [0, 1] } };

export const LinkOrButton: Story = { args: { path: [0, 2] } };

export const Icon: Story = { args: { path: [0, 3] } };

export const ArabicRtl: Story = { args: { path: [0, 0], dir: 'rtl', arabic: true } };
