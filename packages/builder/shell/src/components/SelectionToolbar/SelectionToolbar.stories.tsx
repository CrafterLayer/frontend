import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import type { SelectionTarget, SourceHandle } from '@craftkit/builder-schema';

import { SelectionToolbar } from './SelectionToolbar';

const source: SourceHandle = {
  projectId: 'commerce',
  modulePath: 'pages/home/Page.tsx',
  sourceRevision: 'source-4',
  astNodeId: 'hero-title',
};
const nativeTarget: SelectionTarget = {
  pageId: 'home',
  sourceOrNodeId: 'hero',
  revision: 'site-7',
  capabilities: ['inspect', 'editText', 'editProps', 'duplicate', 'move', 'delete', 'insertInside'],
};
const sourceTarget: SelectionTarget = {
  ...nativeTarget,
  sourceOrNodeId: source,
  capabilities: [
    'inspect',
    'editText',
    'editProps',
    'editClasses',
    'editSource',
    'duplicate',
    'move',
    'delete',
  ],
};

const meta = {
  title: 'Builder/Shell/SelectionToolbar',
  component: SelectionToolbar,
  args: { onAction: fn(), onMovePointerDown: fn() },
} satisfies Meta<typeof SelectionToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Native: Story = { args: { targets: [nativeTarget], hasParent: true } };
export const Source: Story = { args: { targets: [sourceTarget], hasParent: true } };
export const Instance: Story = {
  args: {
    targets: [{ ...sourceTarget, sourceOrNodeId: { ...source, instanceKey: 'hero:desktop' } }],
    hasParent: true,
  },
};
export const MultiSelection: Story = {
  args: { targets: [nativeTarget, { ...nativeTarget, sourceOrNodeId: 'features' }] },
};
export const Limited: Story = {
  args: { targets: [{ ...nativeTarget, capabilities: ['inspect'] }], state: 'stale' },
};
export const SharedSource: Story = {
  args: { targets: [sourceTarget], sharedScope: { instances: 6, pages: 3 }, hasParent: true },
};
