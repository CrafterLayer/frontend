import {
  formatCustomCodePath,
  parseCustomCodePath,
  PART_OWNER_ATTRIBUTE,
  type CustomCodePath,
  type NodeId,
  type PartRef,
  type SlotName,
} from '@craftkit/builder-schema';

import { systemGeometryPorts, type GeometryPorts } from './geometry-ports';

/**
 * A registered block's part under the pointer (block-parts DESIGN §2.6): its
 * declared name, its array indices, and the bound prop path the renderer
 * stamped (`data-ck-bind`), when it stamped one.
 */
export interface CanvasPartHit extends PartRef {
  readonly bind?: string;
}

// ── block-parts (2026-10-06) ── PART_OWNER_ATTRIBUTE: a part a parent draws for a child (Tabs' triggers)
// ── /block-parts ──

/**
 * What the pointer is over: always a document node, and — inside a composed
 * region — the authored element under it, by the path the renderer stamped.
 * `elementPath` is absent for every ordinary block, so a consumer that only
 * knows nodes reads exactly what `nodeAt` would have told it.
 */
export interface CanvasHit {
  readonly nodeId: NodeId;
  readonly elementPath?: CustomCodePath;
  /**
   * The part of a registered block under the point — only when the part's
   * nearest node wrapper IS this node, so a part inside a nested child block
   * belongs to that child. Never set together with `elementPath`: inside a
   * composed region the authored element address keeps precedence.
   */
  readonly part?: CanvasPartHit;
}

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

export interface SlotRect {
  /** Deliberately distinct from NodeRect.nodeId: slot and node geometry cannot share a key. */
  ownerNodeId: NodeId;
  slotName: SlotName;
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
  /**
   * Slot geometry uses a separate namespace and cache. Empty slots measure their
   * real wrapper; populated `display: contents` slots union their direct child
   * node rects. Optional so existing injected node-only test doubles retain the
   * legacy first-slot fallback.
   */
  slotRect?(ownerNodeId: NodeId, slotName: SlotName): SlotRect | undefined;
  /** Identity from point hit-testing — zero measurement on the pointer path. */
  nodeAt(clientX: number, clientY: number): NodeId | undefined;
  /**
   * `nodeAt`, plus the authored element under the point when the node is a
   * composed region whose renderer stamped element paths. Zero measurement.
   * Optional for the same reason as `slotRect`: injected node-only doubles
   * keep working, and a consumer without it falls back to `nodeAt`.
   */
  hitAt?(clientX: number, clientY: number): CanvasHit | undefined;
  /**
   * Geometry of one authored element inside an attached node, by path. Lazy
   * and version-cached like `rect`; `undefined` when the node is not attached
   * or the path is not stamped in its subtree (it was edited away, or never
   * rendered on this canvas). Optional, as `hitAt`.
   */
  elementRect?(id: NodeId, path: CustomCodePath): NodeRect | undefined;
  /**
   * Geometry of one part instance of an attached node (block-parts §2.6).
   * Lazy and version-cached like `elementRect`; `undefined` when the node is
   * not attached or the instance is not stamped inside it (a canvas-only
   * marker, so a published render never has one). Optional, as `hitAt`.
   */
  partRect?(id: NodeId, ref: PartRef): NodeRect | undefined;
  /** The stamped element of one part instance, owned by this node. Optional, as `hitAt`. */
  partElement?(id: NodeId, ref: PartRef): HTMLElement | undefined;
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

/** `data-ck-part-index` → indices; absent/empty is `[]`, anything malformed is refused. */
function parseStampedIndex(text: string | null): readonly number[] | undefined {
  if (text === null || text === '') return [];
  if (!/^\d+(?:\.\d+)*$/u.test(text)) return undefined;
  return text.split('.').map(Number);
}

/** A part name as declared: ASCII words joined by dots (the schema's PART_NAME_PATTERN). */
const STAMPED_PART_NAME = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/u;

/** The part a hit element belongs to, read from its nearest stamped ancestor within `wrapper`. */
function partHitOf(hit: Element, wrapper: Element): CanvasPartHit | undefined {
  const stamped = hit.closest('[data-ck-part]');
  // A part found above the wrapper, or inside a NESTED node, is not this node's.
  if (stamped?.closest('[data-bldr-node]') !== wrapper) return undefined;
  const part = stamped.getAttribute('data-ck-part') ?? '';
  const index = parseStampedIndex(stamped.getAttribute('data-ck-part-index'));
  if (!STAMPED_PART_NAME.test(part) || index === undefined) return undefined;
  const bind = stamped.getAttribute('data-ck-bind');
  return bind === null || bind === '' ? { part, index } : { part, index, bind };
}

// ── block-parts (2026-10-06) ──
/** The child node a forwarded part belongs to (`data-ck-part-owner`), when the stamp names one. */
function partOwnerOf(hit: Element, wrapper: Element): string | undefined {
  const stamped = hit.closest('[data-ck-part]');
  if (stamped?.closest('[data-bldr-node]') !== wrapper) return undefined;
  const owner = stamped.getAttribute(PART_OWNER_ATTRIBUTE);
  return owner === null || owner === '' ? undefined : owner;
}

/** A part forwarded to node `id` by its parent, anywhere in the frame document. */
function forwardedPartElement(frameDocument: Document, id: NodeId, ref: PartRef): HTMLElement | undefined {
  if (!STAMPED_PART_NAME.test(ref.part)) return undefined;
  const wanted = ref.index.join('.');
  for (const candidate of frameDocument.querySelectorAll<HTMLElement>(`[${PART_OWNER_ATTRIBUTE}]`)) {
    if (candidate.getAttribute(PART_OWNER_ATTRIBUTE) !== id) continue;
    if (candidate.getAttribute('data-ck-part') !== ref.part) continue;
    if ((candidate.getAttribute('data-ck-part-index') ?? '') !== wanted) continue;
    return candidate;
  }
  return undefined;
}
// ── /block-parts ──

/** The stamped element of one part instance inside `owner`, never one owned by a nested node. */
function partElementIn(owner: HTMLElement, id: NodeId, ref: PartRef): HTMLElement | undefined {
  if (!STAMPED_PART_NAME.test(ref.part)) return undefined;
  const wanted = ref.index.join('.');
  for (const candidate of owner.querySelectorAll<HTMLElement>(`[data-ck-part="${ref.part}"]`)) {
    if ((candidate.getAttribute('data-ck-part-index') ?? '') !== wanted) continue;
    // ── block-parts (2026-10-06) ── a part drawn here FOR a child is the child's
    const forwardedTo = candidate.getAttribute(PART_OWNER_ATTRIBUTE);
    if (forwardedTo !== null && forwardedTo !== '' && forwardedTo !== id) continue;
    // ── /block-parts ──
    // The nearest node of the part must be the owner itself.
    if (candidate.closest('[data-bldr-node]')?.getAttribute('data-bldr-node') === id) {
      return candidate;
    }
  }
  return undefined;
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
  const slotElements = new Map<NodeId, Map<SlotName, HTMLElement>>();
  const slotRects = new Map<NodeId, Map<SlotName, SlotRect>>();
  // Authored-element geometry, keyed `${nodeId}\n${path}`: a third namespace,
  // so an element can never collide with a node or a slot of the same name.
  const elementRects = new Map<string, NodeRect>();
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
  const observedEmptySlots = new Set<HTMLElement>();

  const updateEmptySlotObservation = (element: HTMLElement) => {
    const isEmpty = element.classList.contains('bldr-slot-empty');
    if (isEmpty && !observedEmptySlots.has(element)) {
      observedEmptySlots.add(element);
      resizeObserver?.observe(element);
    } else if (!isEmpty && observedEmptySlots.delete(element)) {
      resizeObserver?.unobserve(element);
    }
  };

  const forgetOwnedSlotElements = (ownerNodeId: NodeId) => {
    const owned = slotElements.get(ownerNodeId);
    if (owned !== undefined) {
      for (const element of owned.values()) {
        if (observedEmptySlots.delete(element)) {
          resizeObserver?.unobserve(element);
        }
      }
    }
    slotElements.delete(ownerNodeId);
    slotRects.delete(ownerNodeId);
  };

  const slotElementOf = (ownerNodeId: NodeId, slotName: SlotName): HTMLElement | undefined => {
    const owner = elements.get(ownerNodeId);
    if (owner === undefined) {
      return undefined;
    }
    const cached = slotElements.get(ownerNodeId)?.get(slotName);
    if (
      cached !== undefined &&
      owner.contains(cached) &&
      cached.getAttribute('data-bldr-slot-of') === ownerNodeId &&
      cached.getAttribute('data-bldr-slot') === slotName
    ) {
      updateEmptySlotObservation(cached);
      return cached;
    }
    if (cached !== undefined && observedEmptySlots.delete(cached)) {
      resizeObserver?.unobserve(cached);
    }

    for (const candidate of owner.querySelectorAll<HTMLElement>(
      '[data-bldr-slot][data-bldr-slot-of]',
    )) {
      if (
        candidate.getAttribute('data-bldr-slot-of') === ownerNodeId &&
        candidate.getAttribute('data-bldr-slot') === slotName
      ) {
        const owned = slotElements.get(ownerNodeId) ?? new Map<SlotName, HTMLElement>();
        owned.set(slotName, candidate);
        slotElements.set(ownerNodeId, owned);
        updateEmptySlotObservation(candidate);
        return candidate;
      }
    }
    slotElements.get(ownerNodeId)?.delete(slotName);
    return undefined;
  };

  const rectOf = (id: NodeId): NodeRect | undefined => {
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
  };

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
        forgetOwnedSlotElements(id);
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
      forgetOwnedSlotElements(id);
      elements.delete(id);
      rects.delete(id);
      for (const key of elementRects.keys()) {
        if (key.startsWith(`${id}\n`)) {
          elementRects.delete(key);
        }
      }
      invalidate();
    },
    rect: rectOf,
    slotRect(ownerNodeId, slotName) {
      const cached = slotRects.get(ownerNodeId)?.get(slotName);
      if (cached?.version === version) {
        return cached;
      }
      const slotElement = slotElementOf(ownerNodeId, slotName);
      if (slotElement === undefined) {
        return undefined;
      }

      let measured: { x: number; y: number; width: number; height: number };
      if (slotElement.classList.contains('bldr-slot-empty')) {
        measures += 1;
        measured = ports.measure(slotElement);
      } else {
        const children = [...slotElement.children];
        const firstChild = children[0];
        const firstId = firstChild?.getAttribute('data-bldr-node');
        const firstRect = firstId === null || firstId === undefined ? undefined : rectOf(firstId);
        if (firstRect === undefined) {
          return undefined;
        }
        let left = firstRect.x;
        let top = firstRect.y;
        let right = firstRect.x + firstRect.width;
        let bottom = firstRect.y + firstRect.height;
        for (const child of children.slice(1)) {
          const childId = child.getAttribute('data-bldr-node');
          const childRect = childId === null ? undefined : rectOf(childId);
          if (childRect === undefined) {
            return undefined;
          }
          left = Math.min(left, childRect.x);
          top = Math.min(top, childRect.y);
          right = Math.max(right, childRect.x + childRect.width);
          bottom = Math.max(bottom, childRect.y + childRect.height);
        }
        measured = { x: left, y: top, width: right - left, height: bottom - top };
      }

      const record: SlotRect = { ownerNodeId, slotName, ...measured, version };
      const owned = slotRects.get(ownerNodeId) ?? new Map<SlotName, SlotRect>();
      owned.set(slotName, record);
      slotRects.set(ownerNodeId, owned);
      return record;
    },
    nodeAt(clientX, clientY) {
      const hit = ports.hitTest(frameDocument, clientX, clientY);
      const wrapper = hit?.closest('[data-bldr-node]');
      return wrapper?.getAttribute('data-bldr-node') ?? undefined;
    },
    hitAt(clientX, clientY) {
      const hit = ports.hitTest(frameDocument, clientX, clientY);
      const wrapper = hit?.closest('[data-bldr-node]');
      const nodeId = wrapper?.getAttribute('data-bldr-node');
      if (wrapper === null || wrapper === undefined || nodeId === null || nodeId === undefined) {
        return undefined;
      }
      // The nearest stamped ancestor, but only INSIDE this node: a path found
      // above the wrapper belongs to some other region and must not be read
      // as an address within this one.
      const addressed = hit?.closest('[data-ck-path]');
      if (addressed === null || addressed === undefined || !wrapper.contains(addressed)) {
        // ── block-parts (2026-10-06) ──
        // No authored element here: a registered block's part, when the
        // renderer stamped one under the point and it belongs to THIS node.
        const part = hit === null ? undefined : partHitOf(hit, wrapper);
        // A part the parent draws for a child (a tab trigger) is the child's.
        const owner = hit === null || part === undefined ? undefined : partOwnerOf(hit, wrapper);
        if (part !== undefined && owner !== undefined) return { nodeId: owner, part };
        return part === undefined ? { nodeId } : { nodeId, part };
        // ── /block-parts ──
      }
      const elementPath = parseCustomCodePath(addressed.getAttribute('data-ck-path') ?? '');
      return elementPath === undefined ? { nodeId } : { nodeId, elementPath };
    },
    elementRect(id, path) {
      const owner = elements.get(id);
      if (owner === undefined || path.length === 0) {
        return undefined;
      }
      const stamped = formatCustomCodePath(path);
      const key = `${id}\n${stamped}`;
      const cached = elementRects.get(key);
      if (cached?.version === version) {
        return cached;
      }
      // Attribute selectors take the value verbatim; a path is digits and dots,
      // so no escaping is needed — and `parseCustomCodePath` already refused
      // anything else at the hit-test door.
      const element = owner.querySelector<HTMLElement>(`[data-ck-path="${stamped}"]`);
      if (element === null) {
        elementRects.delete(key);
        return undefined;
      }
      measures += 1;
      const record: NodeRect = { nodeId: id, ...ports.measure(element), version };
      elementRects.set(key, record);
      return record;
    },
    // ── block-parts (2026-10-06) ──
    partRect(id, ref) {
      const owner = elements.get(id);
      // Same namespace as element rects, under a prefix no element path can
      // spell (paths are digits and dots; part keys start with `part:`).
      const key = `${id}\npart:${ref.part}@${ref.index.join('.')}`;
      const cached = elementRects.get(key);
      if (cached?.version === version) {
        return cached;
      }
      const element =
        (owner === undefined ? undefined : partElementIn(owner, id, ref)) ??
        forwardedPartElement(frameDocument, id, ref);
      if (element === undefined) {
        elementRects.delete(key);
        return undefined;
      }
      measures += 1;
      const record: NodeRect = { nodeId: id, ...ports.measure(element), version };
      elementRects.set(key, record);
      return record;
    },
    partElement(id, ref) {
      const owner = elements.get(id);
      return (
        (owner === undefined ? undefined : partElementIn(owner, id, ref)) ??
        forwardedPartElement(frameDocument, id, ref)
      );
    },
    // ── /block-parts ──
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
      slotElements.clear();
      slotRects.clear();
      elementRects.clear();
      observedEmptySlots.clear();
    },
  };
}
