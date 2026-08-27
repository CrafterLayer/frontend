import type { NodeId } from '@craftkit/builder-schema';

import type { FloatingAnchor, FloatingBox } from './floating-position';
import type { FrameBridge } from './frame-bridge';
import type { RectIndex } from '../rects';

/**
 * Live anchors for the floating surfaces (009 §2 + §7).
 *
 * The toolbars need three things that CHANGE: the anchor rect, the frame's own
 * box in host space, and the host viewport. This channel supplies all three on
 * the SAME rhythm the outline chrome already uses — observer-driven
 * invalidation (element resize, frame scroll, viewport resize, direction flip,
 * structural mutation) batched into one animation frame.
 *
 * That is the whole reason this milestone needs no auto-update loop: the prior
 * art polls rects at 10 fps precisely because it has no such channel, and the
 * library alternative walks scroll ancestors for the same reason. We already
 * know when geometry changed.
 */
export interface AnchorSnapshot {
  /** The selected node's rect in layer-local space, when it has one. */
  block: FloatingBox | null;
  /** The current text selection's anchor, when an inline edit reports one. */
  text: FloatingAnchor | null;
  frame: FloatingBox;
  viewport: { width: number; height: number };
  visible: { width: number; height: number };
}

export interface AnchorChannelOptions {
  index: RectIndex;
  bridge: FrameBridge;
  /** Batched to the display rhythm — the same scheduler the overlay uses. */
  schedule: (callback: () => void) => () => void;
  /** Called with a fresh snapshot whenever anything it depends on changed. */
  onSnapshot: (snapshot: AnchorSnapshot) => void;
}

export interface AnchorChannel {
  /** The node whose rect feeds `block`; null clears it. */
  setBlock: (nodeId: NodeId | null) => void;
  /**
   * A LIVE measurement of the inline editor's current selection, in FRAME
   * coordinates. Geometry is read during every flush rather than retained as
   * a snapshot, so scroll/reflow invalidations cannot replay a stale rect.
   */
  setText: (measure: (() => FloatingAnchor | null) | null) => void;
  /** Force a recompute (a host scroll or resize the index cannot see). */
  refresh: () => void;
  dispose: () => void;
}

export function createAnchorChannel(options: AnchorChannelOptions): AnchorChannel {
  const { index, bridge, schedule, onSnapshot } = options;
  let blockId: NodeId | null = null;
  let measureText: (() => FloatingAnchor | null) | null = null;
  let cancel: (() => void) | null = null;
  let disposed = false;

  const compute = (): AnchorSnapshot => {
    const rect = blockId === null ? undefined : index.rect(blockId);
    return {
      block:
        rect === undefined
          ? null
          : { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      text: measureText?.() ?? null,
      frame: bridge.frameBox(),
      viewport: bridge.hostViewport(),
      visible: bridge.visibleArea(),
    };
  };

  const flush = () => {
    cancel = null;
    if (disposed) {
      return;
    }
    onSnapshot(compute());
  };

  const markDirty = () => {
    if (disposed || cancel !== null) {
      return;
    }
    cancel = schedule(flush);
  };

  // The SAME invalidation channel the outlines ride: nothing polls.
  const offInvalidate = index.onInvalidate(markDirty);

  return {
    setBlock: (nodeId) => {
      if (blockId === nodeId) {
        return;
      }
      blockId = nodeId;
      markDirty();
    },
    setText: (measure) => {
      measureText = measure;
      markDirty();
    },
    refresh: markDirty,
    dispose: () => {
      disposed = true;
      offInvalidate();
      cancel?.();
      cancel = null;
    },
  };
}
