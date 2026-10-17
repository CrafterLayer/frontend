import {
  PREVIEW_PROTOCOL_VERSION,
  validatePreviewHostCommand,
  type PreviewArtifact,
  type PreviewEnvelope,
  type PreviewHostCommand,
} from '@craftkit/builder/code-runtime/browser';

export type PreviewSurfaceState = 'waiting' | 'loading' | 'ready' | 'error' | 'disposed';

export type PreviewSurfaceEvent =
  | { readonly type: 'focus'; readonly astNodeId: string; readonly rect: PreviewRect }
  | { readonly type: 'navigate'; readonly pageId: string }
  | {
      readonly type: 'diagnostic';
      readonly message: string;
      readonly severity: 'error' | 'warning';
    };

export interface PreviewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PreviewSurface {
  setState(state: PreviewSurfaceState, message?: string): void;
  mount(artifact: PreviewArtifact): Promise<void>;
  focus(astNodeId: string): void;
  subscribe(listener: (event: PreviewSurfaceEvent) => void): () => void;
  dispose(): void;
}

export interface PreviewHostPort {
  readonly artifactOrigin: string;
  readonly parentOrigin: string;
  addMessageListener(listener: (event: PreviewHostMessageEvent) => void): () => void;
  postToParent(message: PreviewEnvelope, targetOrigin: string): void;
  scheduleHeartbeat(callback: () => void, intervalMs: number): () => void;
}

export interface PreviewHostMessageEvent {
  readonly data: unknown;
  readonly origin: string;
  readonly fromParent: boolean;
}

export interface PreviewBridgeOptions {
  readonly host: PreviewHostPort;
  readonly surface: PreviewSurface;
  readonly heartbeatIntervalMs?: number;
  readonly onRejected?: (reason: string) => void;
}

export interface PreviewBootstrapSession {
  readonly state: () => PreviewSurfaceState;
  dispose(): void;
}

interface CurrentPreview {
  readonly artifact: PreviewArtifact;
  readonly channel: string;
}

const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
];

export function previewContentSecurityPolicy(): string {
  return CSP_DIRECTIVES.join('; ');
}

/** Adds defense in depth for authored artifacts. Deployment must send the same policy as a header. */
export function installPreviewCsp(document: Document): void {
  if (document.head.querySelector('meta[http-equiv="Content-Security-Policy"]') !== null) return;
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = previewContentSecurityPolicy();
  document.head.prepend(meta);
}

export function configuredParentOrigin(locationUrl: string): string {
  const url = new URL(locationUrl);
  const raw = url.searchParams.get('parentOrigin');
  if (raw === null) throw new Error('The preview URL is missing its parentOrigin capability.');
  const parent = new URL(raw);
  if (parent.origin !== raw || !isAllowedWebOrigin(parent)) {
    throw new Error('The preview parentOrigin must be an exact secure origin.');
  }
  if (parent.origin === url.origin) {
    throw new Error('The authored preview cannot share its parent origin.');
  }
  return parent.origin;
}

export function assertPreviewOrigin(origin: string): void {
  const url = new URL(origin);
  if (url.origin !== origin || !isAllowedWebOrigin(url)) {
    throw new Error('The preview application must run on HTTPS or a loopback development origin.');
  }
}

/**
 * Owns the child side of the bridge. It accepts one immutable init command,
 * locks identity before awaiting authored code, and rejects every stale or
 * capability-expanding follow-up.
 */
export function createPreviewBridge(options: PreviewBridgeOptions): PreviewBootstrapSession {
  const { host, surface } = options;
  assertPreviewOrigin(host.artifactOrigin);
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 2_000;
  if (
    !Number.isSafeInteger(heartbeatIntervalMs) ||
    heartbeatIntervalMs < 250 ||
    heartbeatIntervalMs > 30_000
  ) {
    throw new Error('Invalid preview heartbeat interval.');
  }

  let current: CurrentPreview | undefined;
  let state: PreviewSurfaceState = 'waiting';
  let disposed = false;
  let stopHeartbeat: (() => void) | undefined;
  let runToken = 0;

  surface.setState('waiting', 'Waiting for an authenticated preview artifact.');

  const reject = (reason: string): void => {
    options.onRejected?.(reason);
  };

  const send = (
    type: PreviewEnvelope['type'],
    payload: Readonly<Record<string, unknown>>,
  ): void => {
    if (disposed || current === undefined) return;
    host.postToParent(
      {
        version: PREVIEW_PROTOCOL_VERSION,
        channel: current.channel,
        projectId: current.artifact.projectId,
        pageId: current.artifact.pageId,
        artifactId: current.artifact.artifactId,
        sourceRevision: current.artifact.sourceRevision,
        type,
        payload,
      },
      host.parentOrigin,
    );
  };

  const stopSurfaceEvents = surface.subscribe((event) => {
    if (disposed || current === undefined || state !== 'ready') return;
    if (event.type === 'focus') {
      if (!current.artifact.targetIds.includes(event.astNodeId)) {
        reject('The selected target is absent from the compiled source map.');
        return;
      }
      send('focus', { astNodeId: event.astNodeId });
      send('geometry', { astNodeId: event.astNodeId, ...event.rect });
      return;
    }
    if (event.type === 'navigate') {
      send('navigate', { pageId: event.pageId });
      return;
    }
    send('diagnostic', { message: event.message.slice(0, 2_000), severity: event.severity });
  });

  const begin = async (command: PreviewHostCommand): Promise<void> => {
    if (command.type !== 'init') return;
    if (state !== 'waiting') {
      reject('The preview session is already initialized.');
      return;
    }
    const token = ++runToken;
    current = { artifact: command.payload.artifact, channel: command.channel };
    state = 'loading';
    surface.setState('loading', 'Loading the authored page.');
    try {
      await surface.mount(command.payload.artifact);
      if (disposed || token !== runToken) return;
      state = 'ready';
      surface.setState('ready');
      send('ready', {});
      stopHeartbeat = host.scheduleHeartbeat(() => {
        send('heartbeat', {});
      }, heartbeatIntervalMs);
    } catch (error) {
      if (disposed || token !== runToken) return;
      state = 'error';
      const message =
        error instanceof Error ? error.message : 'The authored artifact could not load.';
      surface.setState('error', message);
      send('diagnostic', { message: message.slice(0, 2_000), severity: 'error' });
    }
  };

  const removeMessageListener = host.addMessageListener((event) => {
    if (disposed) return;
    if (!event.fromParent) {
      reject('Preview command did not come from the parent frame.');
      return;
    }
    if (event.origin !== host.parentOrigin) {
      reject('Preview command came from the wrong parent origin.');
      return;
    }
    const validated = validatePreviewHostCommand(event.data, {
      artifactOrigin: host.artifactOrigin,
      ...(current === undefined ? {} : { current }),
    });
    if (!validated.ok) {
      reject(validated.reason);
      return;
    }
    if (validated.command.type === 'focus') {
      if (state !== 'ready') {
        reject('Preview focus requires a ready artifact.');
        return;
      }
      surface.focus(validated.command.payload.astNodeId);
      return;
    }
    void begin(validated.command);
  });

  return {
    state: () => state,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      runToken += 1;
      stopHeartbeat?.();
      stopSurfaceEvents();
      removeMessageListener();
      surface.dispose();
      state = 'disposed';
    },
  };
}

export function createBrowserHostPort(window: Window, parentOrigin: string): PreviewHostPort {
  return {
    artifactOrigin: window.location.origin,
    parentOrigin,
    addMessageListener: (listener) => {
      const handler = (event: MessageEvent<unknown>): void => {
        listener({
          data: event.data,
          origin: event.origin,
          fromParent: event.source === window.parent,
        });
      };
      window.addEventListener('message', handler);
      return () => {
        window.removeEventListener('message', handler);
      };
    },
    postToParent: (message, targetOrigin) => {
      window.parent.postMessage(message, targetOrigin);
    },
    scheduleHeartbeat: (callback, intervalMs) => {
      const timer = window.setInterval(callback, intervalMs);
      return () => {
        window.clearInterval(timer);
      };
    },
  };
}

export function createDomPreviewSurface(
  document: Document,
  root: HTMLElement,
  importModule: (url: string) => Promise<unknown> = (url) => import(/* @vite-ignore */ url),
): PreviewSurface {
  const status = document.createElement('div');
  status.className = 'ck-preview-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.before(status);

  const listeners = new Set<(event: PreviewSurfaceEvent) => void>();
  const cleanups: (() => void)[] = [];
  let artifact: PreviewArtifact | undefined;
  let disposed = false;

  const emit = (event: PreviewSurfaceEvent): void => {
    for (const listener of [...listeners]) listener(event);
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element) || artifact === undefined) return;
    const source = target.closest<HTMLElement>('[data-ck-source]');
    const astNodeId = source?.dataset['ckSource'];
    if (source !== null && astNodeId !== undefined && artifact.targetIds.includes(astNodeId)) {
      const rect = source.getBoundingClientRect();
      emit({
        type: 'focus',
        astNodeId,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
    const link = target.closest<HTMLAnchorElement>('a[data-page-id]');
    const pageId = link?.dataset['pageId'];
    if (link !== null && pageId !== undefined && pageId.length > 0) {
      event.preventDefault();
      emit({ type: 'navigate', pageId });
    }
  };

  const onError = (event: ErrorEvent): void => {
    emit({
      type: 'diagnostic',
      message: event.message || 'Preview runtime error.',
      severity: 'error',
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason: unknown = event.reason;
    emit({
      type: 'diagnostic',
      message: readableReason(reason),
      severity: 'error',
    });
  };

  document.addEventListener('click', onClick);
  document.defaultView?.addEventListener('error', onError);
  document.defaultView?.addEventListener('unhandledrejection', onUnhandledRejection);
  cleanups.push(
    () => {
      document.removeEventListener('click', onClick);
    },
    () => {
      document.defaultView?.removeEventListener('error', onError);
    },
    () => {
      document.defaultView?.removeEventListener('unhandledrejection', onUnhandledRejection);
    },
  );

  return {
    setState: (state, message) => {
      status.dataset['state'] = state;
      status.hidden = state === 'ready' || state === 'disposed';
      status.textContent = message ?? '';
    },
    mount: async (nextArtifact) => {
      if (disposed) throw new Error('The preview surface is disposed.');
      artifact = nextArtifact;
      for (const href of nextArtifact.stylesheetUrls) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.integrity = '';
        document.head.appendChild(link);
        cleanups.push(() => {
          link.remove();
        });
      }
      for (const scriptUrl of nextArtifact.scriptUrls) {
        await importModule(scriptUrl);
        if (isDisposed()) return;
      }
    },
    focus: (astNodeId) => {
      if (artifact?.targetIds.includes(astNodeId) !== true) return;
      const target = document.querySelector<HTMLElement>(
        `[data-ck-source="${escapeAttribute(astNodeId)}"]`,
      );
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      target?.focus({ preventScroll: true });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      listeners.clear();
      root.replaceChildren();
      status.remove();
      artifact = undefined;
    },
  };

  function isDisposed(): boolean {
    return disposed;
  }
}

function isAllowedWebOrigin(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  return (
    url.protocol === 'http:' &&
    (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.hostname.endsWith('.localhost'))
  );
}

function escapeAttribute(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function readableReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (typeof reason === 'number' || typeof reason === 'boolean' || typeof reason === 'bigint') {
    return String(reason);
  }
  return 'Unhandled preview rejection.';
}
