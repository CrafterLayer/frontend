// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPreview } from './mount-preview';
import { validatePreviewHostCommand } from './protocol';
import type { PreviewArtifact } from '../contracts';

const origin = 'https://preview.example.test';
const artifact: PreviewArtifact = {
  artifactId: 'a',
  projectId: 'p',
  pageId: 'home',
  sourceRevision: 'r1',
  scriptUrls: [`${origin}/artifacts/a/page.js`],
  stylesheetUrls: [],
  targetIds: ['s-1'],
};
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('isolated preview lifecycle', () => {
  it('rejects host-origin frames and artifact URLs before mounting anything', async () => {
    const container = document.createElement('div');
    const bridge = { onMessage: vi.fn(), onRejected: vi.fn(), onState: vi.fn() };
    await expect(
      mountPreview(container, {
        artifact,
        publicData: {},
        previewUrl: window.location.href,
        expectedOrigin: window.location.origin,
        bridge,
      }),
    ).rejects.toThrow();
    await expect(
      mountPreview(container, {
        artifact: { ...artifact, scriptUrls: ['https://attacker.test/a.js'] },
        publicData: {},
        previewUrl: `${origin}/`,
        expectedOrigin: origin,
        bridge,
      }),
    ).rejects.toThrow();
    expect(container.children).toHaveLength(0);
  });

  it('accepts only the active frame origin/channel/revision and removes owned work on abort', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const bridge = { onMessage: vi.fn(), onRejected: vi.fn(), onState: vi.fn() };
    const controller = new AbortController();
    const session = await mountPreview(container, {
      artifact,
      publicData: { title: 'Public' },
      previewUrl: `${origin}/`,
      expectedOrigin: origin,
      bridge,
      signal: controller.signal,
    });
    expect(new URL(session.frame.src).searchParams.get('parentOrigin')).toBe(
      window.location.origin,
    );
    const envelope = {
      version: 1,
      channel: session.channel,
      projectId: 'p',
      pageId: 'home',
      artifactId: 'a',
      sourceRevision: 'r1',
      type: 'ready',
      payload: {},
    };
    window.dispatchEvent(
      new MessageEvent('message', {
        source: session.frame.contentWindow,
        origin: 'https://attacker.test',
        data: envelope,
      }),
    );
    expect(bridge.onMessage).not.toHaveBeenCalled();
    window.dispatchEvent(
      new MessageEvent('message', {
        source: session.frame.contentWindow,
        origin,
        data: { ...envelope, sourceRevision: 'old' },
      }),
    );
    expect(bridge.onMessage).not.toHaveBeenCalled();
    window.dispatchEvent(
      new MessageEvent('message', { source: session.frame.contentWindow, origin, data: envelope }),
    );
    expect(bridge.onState).toHaveBeenCalledWith('ready');
    expect(bridge.onMessage).toHaveBeenCalledTimes(1);
    expect(() => {
      session.focus('missing');
    }).toThrow(/absent/);
    controller.abort();
    expect(container.children).toHaveLength(0);
    expect(bridge.onState).toHaveBeenLastCalledWith('disposed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expires a frame that never supplies a valid heartbeat', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const bridge = { onMessage: vi.fn(), onRejected: vi.fn(), onState: vi.fn() };
    await mountPreview(container, {
      artifact,
      publicData: {},
      previewUrl: `${origin}/`,
      expectedOrigin: origin,
      bridge,
      heartbeatTimeoutMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(2001);
    expect(bridge.onState).toHaveBeenCalledWith('unresponsive');
    expect(container.children).toHaveLength(0);
  });
});

describe('host command contract', () => {
  const message = {
    version: 1,
    channel: 'c',
    projectId: 'p',
    pageId: 'home',
    artifactId: 'a',
    sourceRevision: 'r1',
    type: 'init',
    payload: { artifact, publicData: { title: 'Public' } },
  };
  it('validates initial identity, public JSON and same-origin immutable references', () => {
    expect(validatePreviewHostCommand(message, { artifactOrigin: origin }).ok).toBe(true);
    expect(
      validatePreviewHostCommand(
        { ...message, payload: { ...message.payload, execute: 'bad' } },
        { artifactOrigin: origin },
      ).ok,
    ).toBe(false);
    expect(
      validatePreviewHostCommand({ ...message, artifactId: 'other' }, { artifactOrigin: origin })
        .ok,
    ).toBe(false);
    expect(validatePreviewHostCommand(message, { artifactOrigin: 'https://other.test' }).ok).toBe(
      false,
    );
    expect(
      validatePreviewHostCommand(
        { ...message, payload: { ...message.payload, publicData: { fn: () => 1 } } },
        { artifactOrigin: origin },
      ).ok,
    ).toBe(false);
  });
  it('requires initialization before a focus command and refuses replacement artifacts', () => {
    const focus = { ...message, type: 'focus', payload: { astNodeId: 's-1' } };
    expect(validatePreviewHostCommand(focus, { artifactOrigin: origin }).ok).toBe(false);
    expect(
      validatePreviewHostCommand(focus, {
        artifactOrigin: origin,
        current: { artifact, channel: 'c' },
      }).ok,
    ).toBe(true);
    expect(
      validatePreviewHostCommand(message, {
        artifactOrigin: origin,
        current: { artifact: { ...artifact, artifactId: 'old' }, channel: 'c' },
      }).ok,
    ).toBe(false);
  });
});
