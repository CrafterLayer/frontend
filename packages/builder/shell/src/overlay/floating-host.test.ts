import { afterEach, describe, expect, it } from 'vitest';

import {
  createFloatingHost,
  systemFloatingPorts,
  type FloatingHost,
  type FloatingTarget,
} from './floating-host';

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

  it('a NON-zoomed canvas writes no counter-scale (and invalid scales count as 1)', () => {
    const { host: created } = make();
    for (const scale of [1, 0, Number.NaN, -2]) {
      created.place(target({ scale }));
      expect(created.element.style.transform).toBe('translate(140px, 260px)');
    }
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

/*
  Canvas zoom: the layer shares the frame's scale(zoom), so an uncompensated
  bar drew 36px targets at ~20px under a 0.57 "Fit". The host counter-scales,
  so its measured size is HOST px and must enter the layer-local math / zoom.
*/
describe('createFloatingHost under canvas zoom — chrome keeps its own size', () => {
  const half = (over: Partial<FloatingTarget> = {}) => target({ scale: 0.5, ...over });

  it('folds scale(1/zoom) into the transform, AFTER the translate', () => {
    const { host: created } = make();
    created.place(half());
    expect(created.element.style.transform).toMatch(/^translate\([^)]*\) scale\(2\)$/u);
    expect(created.element.style.getPropertyValue('scale')).toBe('');
  });

  it('places by the LAYER-LOCAL footprint (own size / zoom) and a host-px gap', () => {
    const { host: created } = make();
    created.place(half());
    // The 120×32 bar covers 240×64 layer px at 50%: centred on the anchor
    // (200 - 240/2 = 80) and one 8px HOST gap (16 layer px) above it
    // (300 - 64 - 16 = 220). Unscaled math would put it at (140, 260) —
    // half its width off-centre and overlapping the anchor.
    expect(created.element.style.transform).toBe('translate(80px, 220px) scale(2)');
    expect(created.element.dataset['placement']).toBe('above');
    expect(created.placement()).toMatchObject({ x: 80, y: 220 });
  });

  it('clamps with host-px padding against the layer-local clip box', () => {
    const { host: created } = make();
    // Anchor at the frame's inline end: the 240-layer-px bar stops 8 layer px
    // (4 host px) short of the 800px clip box: 800 - 240 - 8 = 552.
    created.place(half({ anchor: { x: 700, y: 300, width: 100, height: 40 } }));
    expect(created.placement()?.x).toBe(552);
  });

  it('flips on the HOST-px footprint', () => {
    const { host: created } = make({ width: 120, height: 32 }, { prefer: 'below' });
    // Below needs 32 + 8 = 40 host px. The clip box ends at host 200 + 600 * 0.5
    // = 500; the anchor's bottom sits at host 200 + 520 * 0.5 = 460, so exactly
    // 40 remain — below fits. Two layer px lower it no longer does; a bar that
    // took its 32 + 8 as LAYER px (20 host) would wrongly still stay below.
    created.place(half({ anchor: { x: 100, y: 480, width: 200, height: 40 } }));
    expect(created.element.dataset['placement']).toBe('below');
    created.place(half({ anchor: { x: 100, y: 482, width: 200, height: 40 } }));
    expect(created.element.dataset['placement']).toBe('above');
  });

  it('publishes the arrow offset in HOST px — the arrow is drawn inside the bar', () => {
    const { host: created } = make({ width: 120, height: 32 }, { arrowSize: 8 });
    created.place(half());
    // Centred on the anchor: the middle of a 120-host-px bar, not of 240.
    expect(created.element.style.getPropertyValue('--bldr-arrow-x')).toBe('60px');
  });

  it('lands on whole HOST pixels at a fractional zoom', () => {
    const scale = 0.57;
    const { host: created } = make({ width: 121, height: 33 });
    created.place(target({ scale }));
    const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)$/u.exec(
      created.element.style.transform,
    );
    expect(match).not.toBeNull();
    const [, x, y, counter] = match ?? [];
    expect(Number(counter)).toBeCloseTo(1 / scale, 10);
    for (const value of [x, y]) {
      const host = Number(value) * scale;
      expect(Math.abs(host - Math.round(host))).toBeLessThan(1e-9);
    }
  });

  it('a zoom change re-places from the next target', () => {
    const { host: created } = make();
    created.place(half());
    created.place(target({ scale: 1 }));
    expect(created.element.style.transform).toBe('translate(140px, 260px)');
  });
});

// ── block-parts (2026-10-06) ──
describe("systemFloatingPorts.measure — the element's own px", () => {
  it('reads the layout box, which no transform changes', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'offsetWidth', { value: 260 });
    Object.defineProperty(element, 'offsetHeight', { value: 62 });
    // A transformed ancestor skews the client rect (62 × 0.73 ≈ 45); the
    // layout box is the bar's own size, which the host converts by the zoom.
    element.getBoundingClientRect = () => ({ x: 0, y: 0, width: 190, height: 45 }) as DOMRect;
    expect(systemFloatingPorts().measure(element)).toEqual({ width: 260, height: 62 });
  });

  it('falls back to the client rect where there is no layout (jsdom)', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ x: 0, y: 0, width: 120, height: 32 }) as DOMRect;
    expect(systemFloatingPorts().measure(element)).toEqual({ width: 120, height: 32 });
  });
});
// ── /block-parts ──
