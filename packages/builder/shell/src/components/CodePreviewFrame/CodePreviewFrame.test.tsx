import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PreviewArtifact,
  PreviewBridge,
  PreviewEnvelope,
  PreviewOptions,
  PreviewSession,
} from '@craftkit/builder-code-runtime/browser';

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

interface MountHarness {
  readonly mount: PreviewMount;
  readonly dispose: ReturnType<typeof vi.fn>;
  bridge(): PreviewBridge;
  session(): PreviewSession;
}

function mountHarness(): MountHarness {
  let options: PreviewOptions | undefined;
  let session: PreviewSession | undefined;
  const dispose = vi.fn();
  const mount: PreviewMount = (container, nextOptions) => {
    options = nextOptions;
    const frame = container.ownerDocument.createElement('iframe');
    container.appendChild(frame);
    session = {
      frame,
      channel: 'test-channel',
      focus: vi.fn(),
      dispose: () => {
        dispose();
        frame.remove();
      },
    };
    nextOptions.bridge.onState('loading');
    queueMicrotask(() => {
      nextOptions.bridge.onState('ready');
    });
    return Promise.resolve(session);
  };
  return {
    mount,
    dispose,
    bridge: () => {
      if (options === undefined) throw new Error('preview did not mount');
      return options.bridge;
    },
    session: () => {
      if (session === undefined) throw new Error('preview did not mount');
      return session;
    },
  };
}

const common = {
  sourceRevision: 'source-r2',
  previewUrl: 'https://preview.example.test/',
  expectedOrigin: 'https://preview.example.test',
  publicData: {},
} as const;

describe('CodePreviewFrame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts the isolated artifact, labels its frame, and reports a matching revision', async () => {
    const runtime = mountHarness();
    render(
      <CodePreviewFrame
        {...common}
        artifact={ARTIFACT}
        status="ready"
        previewMount={runtime.mount}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Preview matches source'),
    );
    const frame = screen.getByTitle('Code page preview');
    expect(frame).toHaveAttribute('aria-describedby', screen.getByRole('status').id);
    expect(frame.closest('.bldr-code-preview__mount')).not.toBeNull();
  });

  it('keeps a last-good artifact visible and labels it when source moves ahead', async () => {
    const runtime = mountHarness();
    render(
      <CodePreviewFrame
        {...common}
        sourceRevision="source-r3"
        artifact={ARTIFACT}
        status="ready"
        previewMount={runtime.mount}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Older preview');
    await waitFor(() => expect(screen.getByTitle('Code page preview')).toBeInTheDocument());
  });

  it('does not create a frame while no artifact exists', () => {
    const runtime = mountHarness();
    render(<CodePreviewFrame {...common} status="loading" previewMount={runtime.mount} />);

    expect(screen.getByRole('status')).toHaveTextContent('Building preview');
    expect(screen.queryByTitle('Code page preview')).toBeNull();
  });

  it('keeps the live frame across source errors, callback updates, and zoom changes', async () => {
    const runtime = mountHarness();
    const receive = vi.fn();
    const view = render(
      <CodePreviewFrame
        {...common}
        artifact={ARTIFACT}
        status="ready"
        previewMount={runtime.mount}
        frameWidth={1440}
      />,
    );
    await waitFor(() => expect(screen.getByTitle('Code page preview')).toBeInTheDocument());
    const frame = screen.getByTitle('Code page preview');
    view.rerender(
      <CodePreviewFrame
        {...common}
        publicData={{ title: 'Uncompiled input' }}
        artifact={ARTIFACT}
        sourceRevision="source-r3"
        status="loading"
        previewMount={runtime.mount}
        onRejected={receive}
        frameWidth={1440}
        zoom={0.5}
      />,
    );
    expect(screen.getByTitle('Code page preview')).toBe(frame);
    expect(frame.parentElement?.style.inlineSize).toBe('1440px');
    expect(frame.parentElement?.style.zoom).toBe('0.5');
    view.rerender(
      <CodePreviewFrame
        {...common}
        artifact={ARTIFACT}
        sourceRevision="source-r3"
        status="error"
        previewMount={runtime.mount}
        onRejected={receive}
      />,
    );
    expect(screen.getByTitle('Code page preview')).toBe(frame);
    runtime.bridge().onRejected('Rejected by current callback');
    expect(receive).toHaveBeenCalledWith('Rejected by current callback');
    expect(runtime.dispose).not.toHaveBeenCalled();
  });

  it('keeps the last-good frame when the current source has diagnostics', async () => {
    const runtime = mountHarness();
    render(
      <CodePreviewFrame
        {...common}
        sourceRevision="source-r3"
        artifact={ARTIFACT}
        status="error"
        message="Line 12: expected a closing tag."
        previewMount={runtime.mount}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Source has errors');
    expect(screen.getByRole('status')).toHaveTextContent('Line 12');
    await waitFor(() => expect(screen.getByTitle('Code page preview')).toBeInTheDocument());
  });

  it('offers a keyboard-accessible retry without mounting an unavailable preview', async () => {
    const runtime = mountHarness();
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <CodePreviewFrame
        {...common}
        status="unavailable"
        onRetry={onRetry}
        previewMount={runtime.mount}
      />,
    );

    const retry = screen.getByRole('button', { name: 'Retry preview' });
    await user.tab();
    expect(retry).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle('Code page preview')).toBeNull();
  });

  it('surfaces a rejected bridge message without forwarding it as a trusted event', async () => {
    const runtime = mountHarness();
    const onMessage = vi.fn<(message: PreviewEnvelope) => void>();
    const onRejected = vi.fn<(reason: string) => void>();
    render(
      <CodePreviewFrame
        {...common}
        artifact={ARTIFACT}
        status="ready"
        previewMount={runtime.mount}
        onMessage={onMessage}
        onRejected={onRejected}
      />,
    );
    await waitFor(() => expect(screen.getByTitle('Code page preview')).toBeInTheDocument());

    runtime.bridge().onRejected('Wrong preview origin.');

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Preview message rejected'),
    );
    expect(onRejected).toHaveBeenCalledWith('Wrong preview origin.');
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('disposes the previous session before replacing or unmounting its artifact', async () => {
    const runtime = mountHarness();
    const view = render(
      <CodePreviewFrame
        {...common}
        artifact={ARTIFACT}
        status="ready"
        previewMount={runtime.mount}
      />,
    );
    await waitFor(() => expect(screen.getByTitle('Code page preview')).toBeInTheDocument());

    view.rerender(
      <CodePreviewFrame
        {...common}
        artifact={{ ...ARTIFACT, artifactId: 'artifact-home-r3', sourceRevision: 'source-r3' }}
        sourceRevision="source-r3"
        status="ready"
        previewMount={runtime.mount}
      />,
    );
    await waitFor(() => {
      expect(runtime.dispose).toHaveBeenCalledTimes(1);
    });

    view.unmount();
    expect(runtime.dispose).toHaveBeenCalledTimes(2);
  });

  it('retains the unresponsive state when runtime cleanup reports disposed immediately after it', async () => {
    const runtime = mountHarness();
    render(
      <CodePreviewFrame
        {...common}
        artifact={ARTIFACT}
        status="ready"
        previewMount={runtime.mount}
      />,
    );
    await waitFor(() => expect(screen.getByTitle('Code page preview')).toBeInTheDocument());

    runtime.bridge().onState('unresponsive');
    runtime.bridge().onState('disposed');

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Preview is not responding'),
    );
  });
});
