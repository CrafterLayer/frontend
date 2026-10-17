import type { FloatingBox } from './floating-position';
import type { SelectionCapability, SelectionTarget, SourceHandle } from '@craftkit/builder-schema';

export interface FrameSelectionContext {
  readonly pageId: string;
  readonly revision: string;
  readonly sourceHandleFor?:
    ((astNodeId: string, instanceKey?: string) => SourceHandle | undefined) | undefined;
  readonly sourceCapabilities?:
    ((handle: SourceHandle, element: Element) => readonly SelectionCapability[]) | undefined;
  readonly nodeCapabilities?:
    ((nodeId: string, element: Element) => readonly SelectionCapability[]) | undefined;
}

export interface FrameSelectionHit {
  readonly target: SelectionTarget;
  readonly element: Element;
  readonly framePoint: { readonly x: number; readonly y: number };
  readonly rect: FloatingBox;
}

/**
 * The ONE place host space and frame space meet (006 contract p3, 009 §7 c1).
 *
 * Two documents, two coordinate spaces: the preview content lives inside the
 * iframe, the chrome lives in the host. Everything that crosses does it here —
 * so there is exactly one function to audit, one place a future zoom or device
 * scale multiplies, and no chance of a second, subtly different conversion
 * appearing somewhere else (the failure mode visible in the prior art, where
 * frame offset, scroll, and zoom are folded in by hand across several files).
 *
 * Layer-local coordinates ARE preview-local (005 §1): the overlay layer shares
 * the frame's origin. That is why anchors never convert — only DECISIONS that
 * depend on the host viewport (does a toolbar fit above?) consult `frameBox`.
 */
export interface FrameBridge {
  /** Host viewport coordinates → frame (and therefore layer-local) coordinates. */
  toFrame: (hostX: number, hostY: number) => { x: number; y: number };
  /** Frame/layer-local coordinates → host viewport coordinates. */
  toHost: (frameX: number, frameY: number) => { x: number; y: number };
  /** The frame's own box in host space (position + size). */
  frameBox: () => FloatingBox;
  /** The host viewport, for collision decisions. */
  hostViewport: () => { width: number; height: number };
  /** The frame's visible content area in layer-local space. */
  visibleArea: () => { width: number; height: number };
  /** Visual scale applied around the authored frame coordinate space. */
  scale: () => number;
  /** Resolve the element under a host-space point to current node/source metadata. */
  hitTarget: (
    hostX: number,
    hostY: number,
    context: FrameSelectionContext,
  ) => FrameSelectionHit | undefined;
}

export interface FrameBridgeOptions {
  /** Live visual scale; invalid values safely resolve to 1. */
  readonly scale?: (() => number) | undefined;
}

const SELECTION_CAPABILITIES: readonly SelectionCapability[] = [
  'inspect',
  'editText',
  'editProps',
  'editClasses',
  'editSource',
  'duplicate',
  'move',
  'delete',
  'insertInside',
];

function declaredCapabilities(element: Element): readonly SelectionCapability[] | undefined {
  const raw = element.getAttribute('data-ck-capabilities');
  if (raw === null) return undefined;
  const allow = new Set(SELECTION_CAPABILITIES);
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is SelectionCapability => allow.has(value as SelectionCapability));
  return [...new Set(values)];
}

function closestMetadataElement(element: Element): Element | null {
  return element.closest('[data-ck-source], [data-bldr-node]');
}

/** Convert trusted frame metadata into the one SelectionTarget contract. */
export function selectionTargetFromFrameElement(
  element: Element,
  context: FrameSelectionContext,
): SelectionTarget | undefined {
  const metadata = closestMetadataElement(element);
  if (metadata === null) return undefined;
  const astNodeId = metadata.getAttribute('data-ck-source');
  if (astNodeId !== null) {
    const instanceKey = metadata.getAttribute('data-ck-instance') ?? undefined;
    const resolved = context.sourceHandleFor?.(astNodeId, instanceKey);
    if (resolved === undefined) return undefined;
    if (resolved.instanceKey !== instanceKey) return undefined;
    const handle = { ...resolved };
    return {
      pageId: context.pageId,
      sourceOrNodeId: handle,
      revision: context.revision,
      capabilities: [
        ...(declaredCapabilities(metadata) ??
          context.sourceCapabilities?.(handle, metadata) ?? ['inspect', 'editSource']),
      ],
    };
  }
  const nodeId = metadata.getAttribute('data-bldr-node');
  if (nodeId === null) return undefined;
  return {
    pageId: context.pageId,
    sourceOrNodeId: nodeId,
    revision: context.revision,
    capabilities: [
      ...(declaredCapabilities(metadata) ??
        context.nodeCapabilities?.(nodeId, metadata) ?? ['inspect']),
    ],
  };
}

export function createFrameBridge(
  frame: HTMLIFrameElement,
  options: FrameBridgeOptions = {},
): FrameBridge {
  const box = () => frame.getBoundingClientRect();
  const scale = () => {
    const value = options.scale?.() ?? 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  };
  return {
    toFrame: (hostX, hostY) => {
      const rect = box();
      const factor = scale();
      return { x: (hostX - rect.x) / factor, y: (hostY - rect.y) / factor };
    },
    toHost: (frameX, frameY) => {
      const rect = box();
      const factor = scale();
      return { x: frameX * factor + rect.x, y: frameY * factor + rect.y };
    },
    frameBox: () => {
      const rect = box();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    hostViewport: () => {
      const view = frame.ownerDocument.defaultView;
      /* v8 ignore next 3 -- a mounted iframe always has a defaultView. */
      if (view === null) {
        return { width: 0, height: 0 };
      }
      return { width: view.innerWidth, height: view.innerHeight };
    },
    visibleArea: () => {
      const rect = box();
      const factor = scale();
      return { width: rect.width / factor, height: rect.height / factor };
    },
    scale,
    hitTarget: (hostX, hostY, context) => {
      const rect = box();
      const factor = scale();
      const framePoint = {
        x: (hostX - rect.x) / factor,
        y: (hostY - rect.y) / factor,
      };
      const frameWidth = rect.width / factor;
      const frameHeight = rect.height / factor;
      if (
        framePoint.x < 0 ||
        framePoint.y < 0 ||
        framePoint.x >= frameWidth ||
        framePoint.y >= frameHeight
      ) {
        return undefined;
      }
      const element = frame.contentDocument?.elementFromPoint(framePoint.x, framePoint.y);
      if (element === null || element === undefined) return undefined;
      const target = selectionTargetFromFrameElement(element, context);
      if (target === undefined) return undefined;
      const targetRect = closestMetadataElement(element)?.getBoundingClientRect();
      if (targetRect === undefined) return undefined;
      return {
        target,
        element,
        framePoint,
        rect: {
          x: targetRect.x,
          y: targetRect.y,
          width: targetRect.width,
          height: targetRect.height,
        },
      };
    },
  };
}
