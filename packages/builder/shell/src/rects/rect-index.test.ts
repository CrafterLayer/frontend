import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRectIndex, type RectIndex } from './rect-index';
import type { GeometryPorts } from './geometry-ports';

/** jsdom has no ResizeObserver — a manual-trigger stub drives that channel. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed = new Set<Element>();
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  trigger() {
    this.callback();
  }
}

function mountFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    throw new Error('jsdom iframe must expose contentDocument');
  }
  return frame;
}

function nodeElement(frame: HTMLIFrameElement, id: string): HTMLElement {
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    throw new Error('unreachable');
  }
  const wrapper = frameDocument.createElement('div');
  wrapper.setAttribute('data-bldr-node', id);
  const inner = frameDocument.createElement('span');
  inner.textContent = id;
  wrapper.appendChild(inner);
  frameDocument.body.appendChild(wrapper);
  return wrapper;
}

describe('createRectIndex (005 contract §1)', () => {
  let frame: HTMLIFrameElement;
  let index: RectIndex;
  let measurePort: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    FakeResizeObserver.instances = [];
    frame = mountFrame();
    measurePort = vi.fn(() => ({ x: 1, y: 2, width: 30, height: 40 }));
    index = createRectIndex({
      frame,
      ports: { measure: measurePort as unknown as GeometryPorts['measure'] },
    });
  });

  afterEach(() => {
    index.dispose();
    frame.remove();
    vi.unstubAllGlobals();
  });

  it('never measures while idle — attach and invalidation alone cost zero reads (SC-002)', () => {
    const a = nodeElement(frame, 'a');
    index.attach('a', a);
    frame.contentDocument?.dispatchEvent(new Event('scroll'));
    expect(index.stats().measures).toBe(0);
    expect(index.stats().invalidations).toBeGreaterThanOrEqual(2); // attach + scroll
  });

  it('measures lazily, once per node per version — repeat reads hit the cache', () => {
    index.attach('a', nodeElement(frame, 'a'));
    index.attach('b', nodeElement(frame, 'b'));

    expect(index.rect('a')?.width).toBe(30);
    expect(index.rect('a')).toBe(index.rect('a')); // cached record, same reference
    expect(index.stats().measures).toBe(1);

    frame.contentDocument?.dispatchEvent(new Event('scroll'));
    expect(index.rect('a')?.version).toBe(index.version());
    expect(index.stats().measures).toBe(2); // only the read node re-measured
    expect(index.rect('b')).toBeDefined();
    expect(index.stats().measures).toBe(3);
  });

  it('every observation channel bumps the version without measuring', () => {
    index.attach('a', nodeElement(frame, 'a'));
    const start = index.version();

    frame.contentDocument?.dispatchEvent(new Event('scroll'));
    expect(index.version()).toBe(start + 1);

    frame.contentDocument?.defaultView?.dispatchEvent(new Event('resize'));
    expect(index.version()).toBe(start + 2);

    const observer = FakeResizeObserver.instances[0];
    observer?.trigger();
    expect(index.version()).toBe(start + 3);

    expect(index.stats().measures).toBe(0);
  });

  it('a same-size sibling REORDER invalidates via the structure channel (review High)', async () => {
    // moveNode-style reorders shift positions without resizing anything and
    // without re-running keyed wrappers' refs — childList observation is the
    // only channel that can catch them.
    const a = nodeElement(frame, 'a');
    const b = nodeElement(frame, 'b');
    index.attach('a', a);
    index.attach('b', b);
    expect(index.rect('a')).toBeDefined();
    const start = index.version();
    const measuresBefore = index.stats().measures;

    b.parentNode?.insertBefore(b, a); // pure reorder — no size change anywhere
    await vi.waitFor(() => {
      expect(index.version()).toBeGreaterThan(start);
    });
    expect(index.stats().measures).toBe(measuresBefore); // invalidation only, no eager read
    expect(index.rect('a')?.version).toBe(index.version()); // next read re-measures
  });

  it('a layout-affecting style mutation on a descendant invalidates without measuring', async () => {
    const a = nodeElement(frame, 'a');
    index.attach('a', a);
    const start = index.version();
    a.style.marginBlockStart = '40px'; // shifts siblings; the element itself may not resize
    await vi.waitFor(() => {
      expect(index.version()).toBeGreaterThan(start);
    });
    expect(index.stats().measures).toBe(0);
  });

  it('a dir attribute flip on the frame root invalidates (RTL law)', async () => {
    index.attach('a', nodeElement(frame, 'a'));
    const start = index.version();
    frame.contentDocument?.documentElement.setAttribute('dir', 'rtl');
    await vi.waitFor(() => {
      expect(index.version()).toBeGreaterThan(start);
    });
    expect(index.stats().measures).toBe(0);
  });

  it('nodeAt resolves identity through the wrapper without measuring', () => {
    const wrapper = nodeElement(frame, 'hit-me');
    const inner = wrapper.querySelector('span');
    const withHitTest = createRectIndex({
      frame,
      ports: {
        measure: measurePort as unknown as GeometryPorts['measure'],
        hitTest: () => inner ?? null,
      },
    });
    expect(withHitTest.nodeAt(10, 10)).toBe('hit-me');
    expect(withHitTest.stats().measures).toBe(0);
    withHitTest.dispose();
  });

  it('onInvalidate notifies per observation event (no polling anywhere)', () => {
    index.attach('a', nodeElement(frame, 'a'));
    let notified = 0;
    const off = index.onInvalidate(() => {
      notified += 1;
    });
    frame.contentDocument?.dispatchEvent(new Event('scroll'));
    frame.contentDocument?.defaultView?.dispatchEvent(new Event('resize'));
    expect(notified).toBe(2);
    off();
    frame.contentDocument?.dispatchEvent(new Event('scroll'));
    expect(notified).toBe(2);
  });

  it('detach forgets the node; dispose silences every channel', () => {
    const a = nodeElement(frame, 'a');
    index.attach('a', a);
    expect(index.has('a')).toBe(true);
    index.detach('a');
    expect(index.has('a')).toBe(false);
    expect(index.rect('a')).toBeUndefined();

    const version = index.version();
    index.dispose();
    frame.contentDocument?.dispatchEvent(new Event('scroll'));
    expect(index.version()).toBe(version);
  });
});
