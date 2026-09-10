import { describe, expect, it } from 'vitest';

import { createFrameBridge, selectionTargetFromFrameElement } from './frame-bridge';

function frameAt(box: { x: number; y: number; width: number; height: number }) {
  const view = { innerWidth: 1440, innerHeight: 900 };
  return {
    getBoundingClientRect: () => ({ ...box, top: box.y, left: box.x }),
    ownerDocument: { defaultView: view },
  } as unknown as HTMLIFrameElement;
}

describe('createFrameBridge (009 contract §7 c1)', () => {
  it('converts both ways and ROUND-TRIPS — the pair is the audit surface', () => {
    const bridge = createFrameBridge(frameAt({ x: 240, y: 96, width: 800, height: 600 }));
    const host = { x: 500, y: 300 };
    const inFrame = bridge.toFrame(host.x, host.y);
    expect(inFrame).toEqual({ x: 260, y: 204 });
    expect(bridge.toHost(inFrame.x, inFrame.y)).toEqual(host);
  });

  it('round-trips from the frame side too, for any point', () => {
    const bridge = createFrameBridge(frameAt({ x: 17, y: 43, width: 800, height: 600 }));
    for (const point of [
      { x: 0, y: 0 },
      { x: 799, y: 599 },
      { x: -50, y: -50 }, // outside the frame is still a valid coordinate
      { x: 1200, y: 900 },
    ]) {
      const host = bridge.toHost(point.x, point.y);
      expect(bridge.toFrame(host.x, host.y)).toEqual(point);
    }
  });

  it('re-reads geometry per call, so a moved or resized frame is never stale', () => {
    const box = { x: 100, y: 100, width: 800, height: 600 };
    const bridge = createFrameBridge(frameAt(box));
    expect(bridge.toFrame(150, 150)).toEqual({ x: 50, y: 50 });
    box.x = 300;
    box.y = 40;
    expect(bridge.toFrame(150, 150)).toEqual({ x: -150, y: 110 });
    expect(bridge.frameBox()).toEqual({ x: 300, y: 40, width: 800, height: 600 });
  });

  it('exposes the host viewport and the frame visible area for collision decisions', () => {
    const bridge = createFrameBridge(frameAt({ x: 0, y: 0, width: 834, height: 520 }));
    expect(bridge.hostViewport()).toEqual({ width: 1440, height: 900 });
    expect(bridge.visibleArea()).toEqual({ width: 834, height: 520 });
  });

  it('converts scaled host pixels to exact authored frame coordinates', () => {
    const bridge = createFrameBridge(frameAt({ x: 100, y: 100, width: 400, height: 300 }), {
      scale: () => 0.5,
    });

    expect(bridge.scale()).toBe(0.5);
    expect(bridge.toFrame(300, 150)).toEqual({ x: 400, y: 100 });
    expect(bridge.toHost(400, 100)).toEqual({ x: 300, y: 150 });
    expect(bridge.visibleArea()).toEqual({ width: 800, height: 600 });
    expect(bridge.frameBox()).toEqual({ x: 100, y: 100, width: 400, height: 300 });
  });

  it('exchanges current source identity, instance and capabilities as one target', () => {
    const sourceElement = document.createElement('h1');
    sourceElement.dataset['ckSource'] = 'hero-title';
    sourceElement.dataset['ckInstance'] = 'hero:1';
    sourceElement.dataset['ckCapabilities'] = 'inspect, editText, delete, forged';

    expect(
      selectionTargetFromFrameElement(sourceElement, {
        pageId: 'home',
        revision: 'site-4',
        sourceHandleFor: (astNodeId, instanceKey) => ({
          projectId: 'project',
          modulePath: 'pages/home/Page.tsx',
          sourceRevision: 'source-7',
          astNodeId,
          ...(instanceKey === undefined ? {} : { instanceKey }),
        }),
      }),
    ).toEqual({
      pageId: 'home',
      revision: 'site-4',
      sourceOrNodeId: {
        projectId: 'project',
        modulePath: 'pages/home/Page.tsx',
        sourceRevision: 'source-7',
        astNodeId: 'hero-title',
        instanceKey: 'hero:1',
      },
      capabilities: ['inspect', 'editText', 'delete'],
    });
  });

  it('reads native document node metadata through the same target contract', () => {
    const child = document.createElement('span');
    const wrapper = document.createElement('div');
    wrapper.dataset['bldrNode'] = 'hero';
    wrapper.append(child);

    expect(
      selectionTargetFromFrameElement(child, {
        pageId: 'home',
        revision: 'site-2',
        nodeCapabilities: () => ['inspect', 'editProps'],
      }),
    ).toEqual({
      pageId: 'home',
      revision: 'site-2',
      sourceOrNodeId: 'hero',
      capabilities: ['inspect', 'editProps'],
    });
  });
});
