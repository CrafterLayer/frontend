import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { PreviewArtifact } from '@craftkit/builder-code-runtime/browser';

import { CodePreviewFrame, type PreviewMount } from './CodePreviewFrame';

const ARTIFACT: PreviewArtifact = {
  artifactId: 'artifact-home-r2',
  projectId: 'project-reference',
  pageId: 'home',
  sourceRevision: 'source-r2',
  scriptUrls: ['https://preview.example.test/artifacts/home-r2.js'],
  stylesheetUrls: ['https://preview.example.test/artifacts/home-r2.css'],
  targetIds: ['hero-heading'],
};

const storyMount: PreviewMount = (container, options) => {
  const frame = container.ownerDocument.createElement('iframe');
  frame.srcdoc =
    '<!doctype html><html><body style="font-family:system-ui;padding:32px"><main><p>Reference workspace</p><h1>A page with working interactions.</h1><button>Try the counter</button></main></body></html>';
  container.appendChild(frame);
  options.bridge.onState('loading');
  queueMicrotask(() => {
    options.bridge.onState('ready');
  });
  return Promise.resolve({
    frame,
    channel: 'storybook-preview',
    focus: () => undefined,
    dispose: () => {
      frame.remove();
      options.bridge.onState('disposed');
    },
  });
};

const meta = {
  title: 'Builder/Shell/CodePreviewFrame',
  component: CodePreviewFrame,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ blockSize: '38rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    sourceRevision: 'source-r2',
    previewUrl: 'https://preview.example.test/',
    expectedOrigin: 'https://preview.example.test',
    publicData: {},
    previewMount: storyMount,
  },
} satisfies Meta<typeof CodePreviewFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Matching: Story = {
  args: { artifact: ARTIFACT, status: 'ready' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('Preview matches source');
    await expect(canvas.getByTitle('Code page preview')).toBeVisible();
  },
};

export const Older: Story = {
  args: {
    artifact: { ...ARTIFACT, sourceRevision: 'source-r1' },
    status: 'ready',
    message: 'Current source is still compiling.',
  },
};

export const Loading: Story = {
  args: { status: 'loading' },
};

export const ErrorWithLastGoodPreview: Story = {
  args: {
    artifact: { ...ARTIFACT, sourceRevision: 'source-r1' },
    status: 'error',
    message: 'Line 18: expected a closing tag. Showing the last successful preview.',
  },
};

export const Unavailable: Story = {
  args: { status: 'unavailable', onRetry: () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry preview' }));
  },
};

export const RightToLeft: Story = {
  args: { artifact: ARTIFACT, status: 'ready' },
  decorators: [
    (Story) => (
      <div className="bldr-root" dir="rtl" style={{ blockSize: '38rem' }}>
        <Story />
      </div>
    ),
  ],
};
