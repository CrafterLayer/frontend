import { describe, expect, it, vi } from 'vitest';

import type {
  PreviewArtifact,
  PreviewEnvelope,
  PreviewHostCommand,
} from '@craftkit/builder/code-runtime/browser';

import {
  configuredParentOrigin,
  createPreviewBridge,
  previewContentSecurityPolicy,
  type PreviewHostMessageEvent,
  type PreviewHostPort,
  type PreviewSurface,
  type PreviewSurfaceEvent,
  type PreviewSurfaceState,
} from './bridge';

const PARENT_ORIGIN = 'https://editor.example.test';
const PREVIEW_ORIGIN = 'https://preview.example.test';

const ARTIFACT: PreviewArtifact = {
  artifactId: 'artifact-home-r1',
  projectId: 'project-reference',
  pageId: 'home',
  sourceRevision: 'source-r1',
  scriptUrls: [`${PREVIEW_ORIGIN}/artifacts/home-r1.js`],
  stylesheetUrls: [`${PREVIEW_ORIGIN}/artifacts/home-r1.css`],
  targetIds: ['hero-heading'],
};

function init(artifact: PreviewArtifact = ARTIFACT): PreviewHostCommand {
  return {
    version: 1,
    channel: 'channel-1',
    projectId: artifact.projectId,
    pageId: artifact.pageId,
    artifactId: artifact.artifactId,
    sourceRevision: artifact.sourceRevision,
    type: 'init',
    payload: { artifact, publicData: { locale: 'en' } },
  };
}

interface HostHarness {
  readonly port: PreviewHostPort;
  readonly sent: PreviewEnvelope[];
  readonly stopped: ReturnType<typeof vi.fn>;
  emit(event: PreviewHostMessageEvent): void;
  heartbeat(): void;
  listenerCount(): number;
}

function hostHarness(): HostHarness {
  const listeners = new Set<(event: PreviewHostMessageEvent) => void>();
  const sent: PreviewEnvelope[] = [];
  const stopped = vi.fn();
  let heartbeat = (): void => undefined;
  return {
    port: {
      artifactOrigin: PREVIEW_ORIGIN,
      parentOrigin: PARENT_ORIGIN,
      addMessageListener: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      postToParent: (message, targetOrigin) => {
        expect(targetOrigin).toBe(PARENT_ORIGIN);
        sent.push(message);
      },
      scheduleHeartbeat: (callback) => {
        heartbeat = callback;
        return stopped;
      },
    },
    sent,
    stopped,
    emit: (event) => {
      for (const listener of [...listeners]) listener(event);
    },
    heartbeat: () => {
      heartbeat();
    },
    listenerCount: () => listeners.size,
  };
}

interface SurfaceHarness {
  readonly surface: PreviewSurface;
  readonly states: { state: PreviewSurfaceState; message?: string }[];
  readonly mounted: PreviewArtifact[];
  readonly focused: string[];
  readonly disposed: ReturnType<typeof vi.fn>;
  resolveMount(): void;
  emit(event: PreviewSurfaceEvent): void;
}

function surfaceHarness(options: { deferred?: boolean; failure?: Error } = {}): SurfaceHarness {
  const states: { state: PreviewSurfaceState; message?: string }[] = [];
  const mounted: PreviewArtifact[] = [];
  const focused: string[] = [];
  const disposed = vi.fn();
  const listeners = new Set<(event: PreviewSurfaceEvent) => void>();
  let resolve = (): void => undefined;
  return {
    surface: {
      setState: (state, message) => {
        states.push({ state, ...(message === undefined ? {} : { message }) });
      },
      mount: (artifact) => {
        mounted.push(artifact);
        if (options.failure !== undefined) return Promise.reject(options.failure);
        if (options.deferred !== true) return Promise.resolve();
        return new Promise<void>((done) => {
          resolve = done;
        });
      },
      focus: (astNodeId) => {
        focused.push(astNodeId);
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      dispose: disposed,
    },
    states,
    mounted,
    focused,
    disposed,
    resolveMount: () => {
      resolve();
    },
    emit: (event) => {
      for (const listener of [...listeners]) listener(event);
    },
  };
}

const trustedEvent = (data: unknown): PreviewHostMessageEvent => ({
  data,
  origin: PARENT_ORIGIN,
  fromParent: true,
});

describe('preview bootstrap bridge', () => {
  it('defines a CSP that blocks network, embedding, objects, eval, and inline scripts', () => {
    const policy = previewContentSecurityPolicy();

    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
  });

  it('requires a separate, exact, secure parent origin capability', () => {
    expect(
      configuredParentOrigin(
        `${PREVIEW_ORIGIN}/?parentOrigin=${encodeURIComponent(PARENT_ORIGIN)}`,
      ),
    ).toBe(PARENT_ORIGIN);
    expect(() => configuredParentOrigin(`${PREVIEW_ORIGIN}/`)).toThrow(/missing/u);
    expect(() =>
      configuredParentOrigin(
        `${PREVIEW_ORIGIN}/?parentOrigin=${encodeURIComponent(PREVIEW_ORIGIN)}`,
      ),
    ).toThrow(/cannot share/u);
    expect(() =>
      configuredParentOrigin(
        `${PREVIEW_ORIGIN}/?parentOrigin=${encodeURIComponent('http://editor.example.test')}`,
      ),
    ).toThrow(/secure origin/u);
  });

  it('locks identity before loading, then emits ready and bounded heartbeats', async () => {
    const host = hostHarness();
    const surface = surfaceHarness({ deferred: true });
    const session = createPreviewBridge({ host: host.port, surface: surface.surface });

    host.emit(trustedEvent(init()));

    expect(session.state()).toBe('loading');
    expect(surface.mounted).toEqual([ARTIFACT]);
    expect(surface.states.map(({ state }) => state)).toEqual(['waiting', 'loading']);

    surface.resolveMount();
    await vi.waitFor(() => {
      expect(session.state()).toBe('ready');
    });
    expect(host.sent.map(({ type }) => type)).toEqual(['ready']);

    host.heartbeat();
    expect(host.sent.map(({ type }) => type)).toEqual(['ready', 'heartbeat']);
  });

  it('refuses a forged source and wrong origin before parsing its command', () => {
    const host = hostHarness();
    const surface = surfaceHarness();
    const rejected = vi.fn();
    createPreviewBridge({ host: host.port, surface: surface.surface, onRejected: rejected });

    host.emit({ data: init(), origin: PARENT_ORIGIN, fromParent: false });
    host.emit({ data: init(), origin: 'https://attacker.example.test', fromParent: true });

    expect(rejected).toHaveBeenNthCalledWith(
      1,
      'Preview command did not come from the parent frame.',
    );
    expect(rejected).toHaveBeenNthCalledWith(
      2,
      'Preview command came from the wrong parent origin.',
    );
    expect(surface.mounted).toEqual([]);
  });

  it('rejects an artifact URL outside the preview origin without loading it', () => {
    const host = hostHarness();
    const surface = surfaceHarness();
    const rejected = vi.fn();
    createPreviewBridge({ host: host.port, surface: surface.surface, onRejected: rejected });
    const invalid = {
      ...ARTIFACT,
      scriptUrls: ['https://attacker.example.test/page.js'],
    };

    host.emit(trustedEvent(init(invalid)));

    expect(rejected).toHaveBeenCalledWith('Artifact URL escapes the configured preview origin.');
    expect(surface.mounted).toEqual([]);
    expect(host.sent).toEqual([]);
  });

  it('forwards only source-map targets and applies validated parent focus', async () => {
    const host = hostHarness();
    const surface = surfaceHarness();
    const rejected = vi.fn();
    createPreviewBridge({ host: host.port, surface: surface.surface, onRejected: rejected });
    host.emit(trustedEvent(init()));
    await vi.waitFor(() => {
      expect(host.sent.at(-1)?.type).toBe('ready');
    });

    surface.emit({
      type: 'focus',
      astNodeId: 'hero-heading',
      rect: { x: 12, y: 20, width: 200, height: 48 },
    });
    surface.emit({
      type: 'focus',
      astNodeId: 'forged-target',
      rect: { x: 0, y: 0, width: 1, height: 1 },
    });
    host.emit(
      trustedEvent({
        ...init(),
        type: 'focus',
        payload: { astNodeId: 'hero-heading' },
      }),
    );

    expect(host.sent.slice(-2).map(({ type }) => type)).toEqual(['focus', 'geometry']);
    expect(surface.focused).toEqual(['hero-heading']);
    expect(rejected).toHaveBeenCalledWith(
      'The selected target is absent from the compiled source map.',
    );
  });

  it('cleans listeners, heartbeat, surface, and late async completion exactly once', async () => {
    const host = hostHarness();
    const surface = surfaceHarness({ deferred: true });
    const session = createPreviewBridge({ host: host.port, surface: surface.surface });
    host.emit(trustedEvent(init()));
    expect(host.listenerCount()).toBe(1);

    session.dispose();
    session.dispose();
    surface.resolveMount();
    await Promise.resolve();

    expect(session.state()).toBe('disposed');
    expect(host.listenerCount()).toBe(0);
    expect(host.stopped).not.toHaveBeenCalled();
    expect(surface.disposed).toHaveBeenCalledTimes(1);
    expect(host.sent).toEqual([]);
  });

  it('reports a failed artifact load while retaining the initialized identity', async () => {
    const host = hostHarness();
    const surface = surfaceHarness({ failure: new Error('Artifact integrity failed.') });
    const session = createPreviewBridge({ host: host.port, surface: surface.surface });
    host.emit(trustedEvent(init()));

    await vi.waitFor(() => {
      expect(session.state()).toBe('error');
    });
    expect(surface.states.at(-1)).toEqual({
      state: 'error',
      message: 'Artifact integrity failed.',
    });
    expect(host.sent.at(-1)).toMatchObject({
      type: 'diagnostic',
      payload: { message: 'Artifact integrity failed.', severity: 'error' },
    });
  });
});
