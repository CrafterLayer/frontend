import type { PreviewOptions, PreviewSession } from './contracts';
import { validatePreviewEnvelope } from './protocol';

function previewUrl(value: string, expectedOrigin: string): URL {
  const url = new URL(value);
  const loopback =
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.hostname.endsWith('.localhost');
  if (
    url.origin !== expectedOrigin ||
    url.username !== '' ||
    url.password !== '' ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
  )
    throw new Error('Preview URL must use the configured isolated origin.');
  return url;
}

/** Owns exactly one frame. Authored execution never enters the host document. */
// Validation failures must reject the public Promise API, including before the frame is mounted.
// eslint-disable-next-line @typescript-eslint/require-await
export async function mountPreview(
  container: HTMLElement,
  options: PreviewOptions,
): Promise<PreviewSession> {
  options.signal?.throwIfAborted();
  const owner = container.ownerDocument.defaultView;
  if (owner === null) throw new Error('Preview container has no browsing context.');
  const url = previewUrl(options.previewUrl, options.expectedOrigin);
  if (url.origin === owner.location.origin)
    throw new Error('Authored preview must not share the editor origin.');
  url.searchParams.set('parentOrigin', owner.location.origin);
  for (const asset of [...options.artifact.scriptUrls, ...options.artifact.stylesheetUrls])
    previewUrl(asset, options.expectedOrigin);
  const timeout = options.heartbeatTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 60_000)
    throw new Error('Invalid heartbeat deadline.');
  const channel = globalThis.crypto.randomUUID();
  const frame = container.ownerDocument.createElement('iframe');
  frame.title = 'Page preview';
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  frame.setAttribute(
    'allow',
    "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'",
  );
  frame.style.cssText = 'border:0;width:100%;height:100%;display:block';
  frame.src = url.href;
  let disposed = false;
  let lastMessage = Date.now();
  let windowStarted = Date.now();
  let messagesInWindow = 0;
  const identity = {
    version: 1,
    channel,
    projectId: options.artifact.projectId,
    pageId: options.artifact.pageId,
    artifactId: options.artifact.artifactId,
    sourceRevision: options.artifact.sourceRevision,
  };
  const send = (type: 'init' | 'focus', payload: unknown): void => {
    if (!disposed)
      frame.contentWindow?.postMessage({ ...identity, type, payload }, options.expectedOrigin);
  };
  const onLoad = (): void => {
    send('init', { artifact: options.artifact, publicData: options.publicData });
  };
  const onMessage = (event: MessageEvent<unknown>): void => {
    if (disposed) return;
    // Unrelated windows are ignored, not blamed on this preview session.
    if (event.source !== frame.contentWindow) return;
    if (event.origin !== options.expectedOrigin) {
      options.bridge.onRejected('Wrong preview origin.');
      return;
    }
    if (Date.now() - windowStarted >= 1000) {
      windowStarted = Date.now();
      messagesInWindow = 0;
    }
    if (++messagesInWindow > 120) {
      options.bridge.onRejected('Preview message rate exceeded.');
      return;
    }
    const validated = validatePreviewEnvelope(event.data, options.artifact, channel);
    if (!validated.ok) {
      options.bridge.onRejected(validated.reason);
      return;
    }
    if (validated.message.type === 'heartbeat' || validated.message.type === 'ready')
      lastMessage = Date.now();
    if (validated.message.type === 'ready') options.bridge.onState('ready');
    options.bridge.onMessage(validated.message);
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    owner.clearInterval(timer);
    owner.removeEventListener('message', onMessage);
    frame.removeEventListener('load', onLoad);
    options.signal?.removeEventListener('abort', dispose);
    frame.remove();
    options.bridge.onState('disposed');
  };
  const timer = owner.setInterval(
    () => {
      if (Date.now() - lastMessage > timeout) {
        options.bridge.onState('unresponsive');
        dispose();
      }
    },
    Math.min(timeout, 1000),
  );
  frame.addEventListener('load', onLoad);
  owner.addEventListener('message', onMessage);
  options.signal?.addEventListener('abort', dispose, { once: true });
  options.bridge.onState('loading');
  container.appendChild(frame);
  if (options.signal?.aborted === true) dispose();
  return {
    frame,
    channel,
    dispose,
    focus(astNodeId) {
      if (!options.artifact.targetIds.includes(astNodeId))
        throw new Error('Focus target is absent from the compiled source map.');
      send('focus', { astNodeId });
    },
  };
}
