import type { NodeId } from '@craftkit/builder-schema';

import { systemGeometryPorts, type GeometryPorts } from './geometry-ports';

export interface NodeRect {
  nodeId: NodeId;
  /** Preview-local coordinates (= chrome-layer-local; see GeometryPorts). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Index version this measurement was taken at. */
  version: number;
}

export interface RectIndex {
  /** Callback-ref driven membership — the renderer reports, the index never scans. */
  attach(id: NodeId, element: HTMLElement): void;
  detach(id: NodeId): void;
  /** Lazy: re-measures ONLY this element, and only when its cache is stale. */
  rect(id: NodeId): NodeRect | undefined;
  /** Identity from point hit-testing — zero measurement on the pointer path. */
  nodeAt(clientX: number, clientY: number): NodeId | undefined;
  has(id: NodeId): boolean;
  /**
   * The attached element, for chrome that must mark a node's STATE on the node
   * itself rather than only draw over it. Read-only by contract: the index owns
   * membership, and a caller that moved geometry through here would put the
   * cache and the page out of step.
   */
  element(id: NodeId): HTMLElement | undefined;
  /** Monotonic; bumped by observation only (FR-002). */
  version(): number;
  /**
   * Observation-driven notification (no polling anywhere): fires after every
   * invalidation. Consumers mark themselves dirty and read lazily on their own
   * frame flush. Returns an unsubscribe.
   */
  onInvalidate(listener: () => void): () => void;
  /** Test instrumentation (Lane-A observer-attribution proofs). */
  stats(): { measures: number; invalidations: number };
  dispose(): void;
}

/**
 * Observer-invalidated geometry index (005 contract §1). Invalidation sources —
 * each bumps the version in O(1) with NO measurement: one shared ResizeObserver
 * over attached elements · frame scroll (capture) · frame viewport resize · a
 * `dir` attribute change on the frame root. Nothing polls; idle cost is zero;
 * measurement happens lazily per consumer read.
 */
export function createRectIndex(options: {
  frame: HTMLIFrameElement;
  ports?: Partial<GeometryPorts> | undefined;
}): RectIndex {
  const { frame } = options;
  const ports: GeometryPorts = { ...systemGeometryPorts(), ...options.ports };
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    throw new Error('createRectIndex requires a mounted same-origin frame.');
  }

  const elements = new Map<NodeId, HTMLElement>();
  const rects = new Map<NodeId, NodeRect>();
  let version = 0;
  let measures = 0;
  let invalidations = 0;
  let disposed = false;
  const invalidateListeners = new Set<() => void>();

  const invalidate = () => {
    if (disposed) {
      return;
    }
    version += 1;
    invalidations += 1;
    for (const listener of invalidateListeners) {
      listener();
    }
  };

  // jsdom has no ResizeObserver; the channel is simply absent there and tests
  // install a stub when they need to drive it.
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(invalidate);

  const dirObserver = new MutationObserver(invalidate);
  dirObserver.observe(frameDocument.documentElement, {
    attributes: true,
    attributeFilter: ['dir'],
  });
  // Structural/layout-affecting mutations: a same-size sibling REORDER (e.g. a
  // moveNode dispatched from another surface) moves DOM without firing any
  // ResizeObserver and without re-running keyed wrappers' refs — this channel
  // catches it (childList), plus style/class edits that shift positions without
  // resizing the changed element itself. Still O(1): invalidate only, measure
  // stays lazy. It also guarantees the FIRST content commit invalidates.
  const structureObserver = new MutationObserver(invalidate);
  structureObserver.observe(frameDocument.body, {
    attributeFilter: ['class', 'style'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  frameDocument.addEventListener('scroll', invalidate, { capture: true, passive: true });
  frameDocument.defaultView?.addEventListener('resize', invalidate);

  return {
    attach(id, element) {
      const previous = elements.get(id);
      if (previous === element) {
        return;
      }
      if (previous !== undefined) {
        resizeObserver?.unobserve(previous);
      }
      elements.set(id, element);
      resizeObserver?.observe(element);
      invalidate(); // new geometry exists; consumers must re-read
    },
    detach(id) {
      const element = elements.get(id);
      if (element === undefined) {
        return;
      }
      resizeObserver?.unobserve(element);
      elements.delete(id);
      rects.delete(id);
      invalidate();
    },
    rect(id) {
      const element = elements.get(id);
      if (element === undefined) {
        return undefined;
      }
      const cached = rects.get(id);
      if (cached?.version === version) {
        return cached;
      }
      measures += 1;
      const measured = ports.measure(element);
      const record: NodeRect = { nodeId: id, ...measured, version };
      rects.set(id, record);
      return record;
    },
    nodeAt(clientX, clientY) {
      const hit = ports.hitTest(frameDocument, clientX, clientY);
      const wrapper = hit?.closest('[data-bldr-node]');
      return wrapper?.getAttribute('data-bldr-node') ?? undefined;
    },
    has: (id) => elements.has(id),
    element: (id) => elements.get(id),
    version: () => version,
    onInvalidate(listener) {
      invalidateListeners.add(listener);
      return () => {
        invalidateListeners.delete(listener);
      };
    },
    stats: () => ({ measures, invalidations }),
    dispose() {
      disposed = true;
      invalidateListeners.clear();
      resizeObserver?.disconnect();
      dirObserver.disconnect();
      structureObserver.disconnect();
      frameDocument.removeEventListener('scroll', invalidate, { capture: true });
      frameDocument.defaultView?.removeEventListener('resize', invalidate);
      elements.clear();
      rects.clear();
    },
  };
}
