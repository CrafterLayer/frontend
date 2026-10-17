import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CodeWorkspacePort, CodeWorkspaceSnapshot } from './code-workspace';
import { CodeWorkspace } from './code-workspace';

const snapshot: CodeWorkspaceSnapshot = {
  pageId: 'home',
  files: [
    {
      projectId: 'northstar',
      modulePath: 'pages/home/index.tsx',
      projectRevision: 'project-r7',
      expectedFileHash: 'file-r7',
      file: {
        language: 'tsx',
        source: `export default function Home() {
  return <main><h1>Northstar Studio</h1></main>;
}`,
      },
      dirty: true,
    },
    {
      projectId: 'northstar',
      modulePath: 'pages/home/styles.css',
      projectRevision: 'project-r7',
      expectedFileHash: 'styles-r7',
      file: { language: 'css', source: 'main { max-width: 72rem; }' },
      dirty: false,
    },
  ],
  activeFile: {
    projectId: 'northstar',
    modulePath: 'pages/home/index.tsx',
    projectRevision: 'project-r7',
    expectedFileHash: 'file-r7',
    file: {
      language: 'tsx',
      source: `export default function Home() {
  return <main><h1>Northstar Studio</h1></main>;
}`,
    },
    dirty: true,
  },
  selectedSource: {
    handle: {
      projectId: 'northstar',
      modulePath: 'pages/home/index.tsx',
      sourceRevision: 'project-r7',
      astNodeId: 'heading-main',
    },
    from: 48,
    to: 64,
  },
  diagnostics: [],
  completions: [
    { label: 'Button', detail: '@craftkit/ui', type: 'class' },
    { label: 'Card', detail: '@craftkit/ui', type: 'class' },
  ],
  diff: { id: 'diff-7', original: 'export default function Home() { return null; }' },
  impact: { kind: 'instance', pageId: 'home' },
  impactStale: false,
  status: 'ready',
};

const storyPort: CodeWorkspacePort = {
  subscribe: () => () => undefined,
  getSnapshot: () => snapshot,
  selectFile: () => undefined,
  updateDraft: () => undefined,
  saveDraft: () => undefined,
  approveDiff: () => undefined,
  rejectDiff: () => undefined,
  refreshImpact: () => undefined,
  navigateToSource: () => undefined,
};

const meta = {
  title: 'Playground/Preview/CodeWorkspace',
  component: CodeWorkspace,
  args: { port: storyPort },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CodeWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InvalidSource: Story = {
  args: {
    port: {
      ...storyPort,
      getSnapshot: () => ({
        ...snapshot,
        diagnostics: [
          {
            code: 'tsx/close-tag',
            message: 'Expected a closing tag.',
            severity: 'error',
            modulePath: 'pages/home/index.tsx',
            line: 2,
            column: 44,
          },
        ],
        status: 'error',
        statusMessage: 'Draft saved. Preview remains on project-r6.',
      }),
    },
  },
};

export const Empty: Story = {
  args: {
    port: {
      ...storyPort,
      getSnapshot: () => ({ ...snapshot, files: [], activeFile: null, selectedSource: null }),
    },
  },
};
