import { afterEach, describe, expect, it } from 'vitest';

import { createFloatingHost, type FloatingHost, type FloatingTarget } from './floating-host';

let host: FloatingHost | null = null;
afterEach(() => {
  host?.dispose();
  host = null;
  document.body.replaceChildren();
});

const FRAME = { x: 0, y: 200, width: 800, height: 600 };
const VIEWPORT = { width: 1200, height: 1000 };

function make(size = { width: 120, height: 32 }, options: Record<string, unknown> = {}) {
  const layer = document.createElement('div');
  document.body.append(layer);
  const noop: () => void = () => undefined;
  let onResize: () => void = noop;
  const created = createFloatingHost({
    layer,
    ...options,
    ports: {
      measure: () => size,
      observe: (_element, callback) => {
        onResize = callback;
        return () => {
          onResize = noop;
        };
      },
    },
  });
  host = created;
  return {
    host: created,
    layer,
    resize: () => {
      onResize();
    },
    size,
  };
}

const target = (over: Partial<FloatingTarget> = {}): FloatingTarget => ({
  anchor: { x: 100, y: 300, width: 200, height: 40 },
  frame: FRAME,
  viewport: VIEWPORT,
  dir: 'ltr',
  ...over,
});

describe('createFloatingHost (009 §2/§7)', () => {
  it('mounts hidden — never a flash at the layer origin before measurement', () => {
    const { host: created, layer } = make();
    expect(layer.firstElementChild).toBe(created.element);
    expect(created.element.style.visibility).toBe('hidden');
    expect(created.placement()).toBeNull();
  });

  it('writes the placement to the DOM, not to React', () => {
    const { host: created } = make();
    created.place(target());

    // Above the anchor (300 - 32 - 8 = 260), centred on it (200 - 120/2 = 140).
    expect(created.element.style.transform).toBe('translate(140px, 260px)');
    expect(created.element.dataset['placement']).toBe('above');
    expect(created.element.style.visibility).toBe('visible');
  });

  it('rounds to whole pixels — a half-pixel transform blurs text on every bar', () => {
    const { host: created } = make({ width: 121, height: 33 });
    created.place(target());
    expect(created.element.style.transform).toBe('translate(140px, 259px)');
  });

  it('publishes the arrow offset as a custom property when the bar draws one', () => {
    const { host: created } = make({ width: 120, height: 32 }, { arrowSize: 8 });
    created.place(target());
    expect(created.element.style.getPropertyValue('--bldr-arrow-x')).toBe('60px');
  });

  it('hides when the anchor scrolls out of the frame — not floats over nothing', () => {
    const { host: created } = make();
    created.place(target());
    created.place(target({ anchor: { x: 100, y: -500, width: 200, height: 40 } }));
    expect(created.element.style.visibility).toBe('hidden');
    expect(created.placement()?.hidden).toBe(true);
  });

  it('a null anchor hides it and clears the placement', () => {
    const { host: created } = make();
    created.place(target());
    created.place(target({ anchor: null }));
    expect(created.element.style.visibility).toBe('hidden');
    expect(created.placement()).toBeNull();
    expect(created.element.dataset['placement']).toBeUndefined();
  });

  it('stays hidden while unmeasurable, then lands MEASURED when the size arrives', () => {
    // React mounts the buttons a beat after the host exists; placing against a
    // 0×0 element would centre the bar on a width it does not have.
    const layer = document.createElement('div');
    document.body.append(layer);
    let onResize: () => void = () => undefined;
    const size = { width: 0, height: 0 };
    const created = createFloatingHost({
      layer,
      ports: {
        measure: () => size,
        observe: (_element, callback) => {
          onResize = callback;
          return () => undefined;
        },
      },
    });
    host = created;

    created.place(target());
    expect(created.element.style.visibility).toBe('hidden');

    size.width = 120;
    size.height = 32;
    onResize();
    expect(created.element.style.visibility).toBe('visible');
    expect(created.element.style.transform).toBe('translate(140px, 260px)');
  });

  it('a CONTENT size change re-places from the last input (no new anchor needed)', () => {
    const { host: created, resize, size } = make();
    created.place(target());
    size.width = 300;
    resize();
    expect(created.element.style.transform).toBe('translate(50px, 260px)');
  });

  it('align:start mirrors under RTL — the bar hugs the reading start', () => {
    const { host: created } = make({ width: 120, height: 32 }, { align: 'start' });
    created.place(target());
    expect(created.element.style.transform).toBe('translate(100px, 260px)');

    created.place(target({ dir: 'rtl' }));
    expect(created.element.style.transform).toBe('translate(180px, 260px)');
  });

  it('flips below when there is no room above in HOST space', () => {
    const { host: created } = make();
    // Frame pinned to the viewport top: the anchor's host-space top is 20px.
    created.place(
      target({ frame: { ...FRAME, y: 0 }, anchor: { x: 100, y: 20, width: 200, height: 40 } }),
    );
    expect(created.element.dataset['placement']).toBe('below');
    expect(created.element.style.transform).toBe('translate(140px, 68px)');
  });

  it('dispose detaches the observer and removes the element from the layer', () => {
    const { host: created, layer, resize } = make();
    created.place(target());
    created.dispose();
    host = null;
    expect(layer.firstElementChild).toBeNull();
    resize(); // must not throw against a detached element
  });
});
