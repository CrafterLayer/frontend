import { describe, expect, it, vi } from 'vitest';

import { systemGeometryPorts } from './geometry-ports';

describe('systemGeometryPorts (real implementations)', () => {
  it('measure reads the element box in preview-local coordinates', () => {
    const ports = systemGeometryPorts();
    const element = document.createElement('div');
    document.body.appendChild(element);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      x: 3,
      y: 4,
      width: 50,
      height: 60,
      top: 4,
      left: 3,
      right: 53,
      bottom: 64,
      toJSON: () => ({}),
    });
    expect(ports.measure(element)).toEqual({ x: 3, y: 4, width: 50, height: 60 });
    element.remove();
  });

  it('hitTest delegates to the frame document point hit-test, null on layout-less hosts', () => {
    const ports = systemGeometryPorts();
    // jsdom has NO elementFromPoint — the port degrades to "no hit" (guard branch):
    expect(ports.hitTest(document, 10, 20)).toBeNull();

    const marker = document.createElement('span');
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null;
    };
    const fromPoint = vi.fn().mockReturnValue(marker);
    doc.elementFromPoint = fromPoint;
    try {
      expect(ports.hitTest(document, 10, 20)).toBe(marker);
      expect(fromPoint).toHaveBeenCalledWith(10, 20);
    } finally {
      delete doc.elementFromPoint;
    }
  });

  it('schedule runs on the frame rhythm and its cancel prevents the callback', async () => {
    const ports = systemGeometryPorts();
    const ran = vi.fn();
    ports.schedule(ran);
    const cancelled = vi.fn();
    const cancel = ports.schedule(cancelled);
    cancel();
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve(undefined);
      });
    });
    expect(ran).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
