import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import type { RectIndex } from '../rects';
import { createToolHost, defineCanvasTool, type CanvasToolTarget } from './tool-host';

function stubIndex(): RectIndex {
  return {
    attach: () => undefined,
    detach: () => undefined,
    rect: (id) => ({ nodeId: id, x: 9, y: 9, width: 20, height: 20, version: 1 }),
    nodeAt: () => undefined,
    has: () => true,
    element: () => undefined,
    version: () => 1,
    onInvalidate: () => () => undefined,
    stats: () => ({ measures: 0, invalidations: 0 }),
    dispose: () => undefined,
  };
}

function toolManifest(
  id: string,
  on: 'selection' | 'hover' | 'always',
  mount: (target: CanvasToolTarget) => () => void,
): TrustedExtensionManifest {
  return {
    tier: 1,
    name: `ext-${id}`,
    version: '1.0.0',
    contributes: { canvasTools: [defineCanvasTool({ id, on, mount })] },
  };
}

function setup() {
  const kernel = createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('th') },
  });
  const layer = document.createElement('div');
  const errors: string[] = [];
  const host = createToolHost({
    kernel,
    index: stubIndex(),
    layer,
    onToolError: (toolId) => errors.push(toolId),
  });
  return { kernel, layer, host, errors };
}

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createToolHost (005 contract §5)', () => {
  it('mounts a selection tool with the concrete target and cleans up exactly once (g1/g2)', async () => {
    const { kernel, layer, host } = setup();
    const cleanup = vi.fn();
    const targets: CanvasToolTarget[] = [];
    const mount = vi.fn((target: CanvasToolTarget) => {
      targets.push(target);
      return cleanup;
    });
    kernel.extensions.register(toolManifest('badge', 'selection', mount));

    host.notifySelection('p1');
    await flushMicrotasks();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(targets[0]).toMatchObject({ nodeId: 'p1' });
    expect(targets[0]?.rect.width).toBe(20);
    expect(targets[0]?.layer).toBe(layer);
    expect(targets[0]?.ctx).toBe(kernel.context);

    host.notifySelection('hero1'); // target change → cleanup, remount
    await flushMicrotasks();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);

    host.notifySelection(null); // activation end → cleanup only
    await flushMicrotasks();
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it('runtime disposal removes a mounted tool; registration mid-activation mounts it (FR-013)', async () => {
    const { kernel, host } = setup();
    const cleanup = vi.fn();
    host.notifySelection('p1'); // selected BEFORE the tool exists
    await flushMicrotasks();

    kernel.extensions.register(toolManifest('late', 'selection', () => cleanup));
    await flushMicrotasks();
    expect(cleanup).not.toHaveBeenCalled(); // mounted, not cleaned

    kernel.extensions.dispose('ext-late');
    await flushMicrotasks();
    expect(cleanup).toHaveBeenCalledTimes(1); // registry change ran the cleanup
  });

  it('contains load rejections and mount throws; other tools survive (g3)', async () => {
    const { kernel, host, errors, layer } = setup();
    kernel.extensions.register({
      tier: 1,
      name: 'ext-broken',
      version: '1.0.0',
      contributes: {
        canvasTools: [
          { id: 'boom-load', on: 'selection', load: () => Promise.reject(new Error('nope')) },
          {
            id: 'boom-mount',
            on: 'selection',
            load: () =>
              Promise.resolve({
                default: () => {
                  throw new Error('mount failed');
                },
              }),
          },
        ],
      },
    });
    const healthy = vi.fn(() => () => undefined);
    kernel.extensions.register(toolManifest('healthy', 'selection', healthy));

    host.notifySelection('p1');
    await flushMicrotasks();
    expect(errors).toContain('boom-load');
    expect(errors).toContain('boom-mount');
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(layer.isConnected).toBe(false); // detached test layer unaffected either way
  });

  it("mounts 'always' tools for the root on start; hover tools on hover (g4 lifecycle)", async () => {
    const { kernel, host } = setup();
    const alwaysTargets: CanvasToolTarget[] = [];
    const alwaysMount = vi.fn((target: CanvasToolTarget) => {
      alwaysTargets.push(target);
      return () => undefined;
    });
    const hoverCleanup = vi.fn();
    kernel.extensions.register(toolManifest('corner', 'always', alwaysMount));
    kernel.extensions.register(toolManifest('peek', 'hover', () => hoverCleanup));

    host.start();
    await flushMicrotasks();
    expect(alwaysMount).toHaveBeenCalledTimes(1);
    expect(alwaysTargets[0]).toMatchObject({ nodeId: 'root' });

    host.notifyHover('hero1');
    await flushMicrotasks();
    host.notifyHover(null);
    await flushMicrotasks();
    expect(hoverCleanup).toHaveBeenCalledTimes(1);
  });

  it('drops a target whose NODE disappeared even when the id is unchanged (review High)', async () => {
    const { kernel, host } = setup();
    const cleanup = vi.fn();
    kernel.extensions.register(toolManifest('badge', 'selection', () => cleanup));

    host.notifySelection('p1');
    await flushMicrotasks();
    expect(cleanup).not.toHaveBeenCalled();

    kernel.dispatch('removeNode', { id: 'p1' });
    host.notifySelection('p1'); // same id, but the node is gone now
    await flushMicrotasks();
    expect(cleanup).toHaveBeenCalledTimes(1); // chrome cleared, not orphaned
  });

  it('dispose runs every outstanding cleanup and blocks later mounts (g2)', async () => {
    const { kernel, host } = setup();
    const cleanup = vi.fn();
    kernel.extensions.register(toolManifest('badge', 'selection', () => cleanup));
    host.notifySelection('p1');
    await flushMicrotasks();

    host.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);

    host.notifySelection('hero1');
    await flushMicrotasks();
    expect(cleanup).toHaveBeenCalledTimes(1); // nothing remounts after dispose
  });
});
