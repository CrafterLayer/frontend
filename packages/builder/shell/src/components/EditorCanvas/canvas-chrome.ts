import type { BuilderKernel } from '@craftkit/builder-core';
import type { StyleBucket, StyleSectorId, StyleState } from '@craftkit/builder-schema';

import { customCodeElementAt } from '../../custom-code/element-at';
import { createElementHandles, type ElementHandles } from '../../overlay/element-handles';
import {
  createFloatingHost,
  type FloatingHost,
  type FloatingHostPorts,
} from '../../overlay/floating-host';
import { createForcedStatePreview, type ForcedStatePreview } from '../../overlay/forced-state';
import { createGridOverlay, readGridMetrics, type GridOverlay } from '../../overlay/grid-overlay';
import { createGuideChrome, type GuideChrome } from '../../overlay/snap-guides';
import type { TreeTextSession } from '../../overlay/tree-text-session';
import type { RectIndex } from '../../rects';
import { PART_ANCHOR_PATH } from './canvas-targets';
import type { Machinery } from './EditorCanvas.types';
import { elementDomOf, focusedTreeTarget } from './element-canvas-helpers';

/*
  The canvas chrome one frame mount builds: the three floating toolbar hosts
  and the P7 element chrome. Plain TS — React only receives the hosts' mount
  elements once, and never hears about geometry.
*/

interface Ref<T> {
  current: T;
}

export interface FloatingHosts {
  textHost: FloatingHost;
  blockHost: FloatingHost;
  elementHost: FloatingHost;
}

/** Floating chrome (009 §10): the formatting bubble, the action bar and the element quick bar. */
export function createFloatingHosts(
  layer: HTMLElement,
  floatingPorts: Partial<FloatingHostPorts> | undefined,
): FloatingHosts {
  const textHost = createFloatingHost({
    layer,
    className: 'bldr-floating--bubble',
    align: 'center',
    arrowSize: 10,
    ...(floatingPorts === undefined ? {} : { ports: floatingPorts }),
  });
  // Below-centre, because the selection outline's name chip owns the block's
  // top-start corner — stacking the bar there collides with it (and
  // below-centre is where the reference design seats it).
  const blockHost = createFloatingHost({
    layer,
    className: 'bldr-floating--actions',
    align: 'center',
    prefer: 'below',
    ...(floatingPorts === undefined ? {} : { ports: floatingPorts }),
  });
  // P7: the element quick bar sits ABOVE the element, flipping below when
  // clipped (§A.6). Same anchor as the action bar — only one of the two
  // ever has content, and an empty host stays hidden.
  const elementHost = createFloatingHost({
    layer,
    className: 'bldr-floating--element',
    align: 'start',
    prefer: 'above',
    // ── block-parts (2026-10-06) ── the bar never covers the part it edits
    keepClear: true,
    // ── /block-parts ──
    ...(floatingPorts === undefined ? {} : { ports: floatingPorts }),
  });
  return { textHost, blockHost, elementHost };
}

export interface ElementChromeInputs {
  layer: HTMLElement;
  kernel: BuilderKernel;
  index: RectIndex;
  editable: boolean;
  bucketRef: Ref<StyleBucket>;
  styleStateRef: Ref<StyleState>;
  activeSectorRef: Ref<StyleSectorId | null>;
  dirRef: Ref<'ltr' | 'rtl'>;
  zoomRef: Ref<number>;
  treeSessionRef: Ref<TreeTextSession | null>;
  machineryRef: Ref<Machinery | null>;
  announceGestureRef: Ref<(message: string) => void>;
  onScrubChange: (scrubbing: boolean) => void;
}

export interface ElementChrome {
  handles: ElementHandles | null;
  grid: GridOverlay;
  forced: ForcedStatePreview;
  positionGuides: GuideChrome;
  /** Re-reads the focused element's chrome; called on every anchor-channel flush. */
  sync: () => void;
}

/**
 * P7 element chrome: spacing handles (editable canvases only), the grid
 * overlay, the forced-state stamp and the positioning guides. All plain TS,
 * all synced on the anchor channel's rhythm — never per React render.
 */
export function createElementChrome({
  layer,
  kernel,
  index,
  editable,
  bucketRef,
  styleStateRef,
  activeSectorRef,
  dirRef,
  zoomRef,
  treeSessionRef,
  machineryRef,
  announceGestureRef,
  onScrubChange,
}: ElementChromeInputs): ElementChrome {
  const handles = editable
    ? createElementHandles({
        layer,
        kernel,
        bucket: () => bucketRef.current,
        state: () => styleStateRef.current,
        dir: () => dirRef.current,
        scale: () => zoomRef.current,
        announce: (message) => {
          announceGestureRef.current(message);
        },
        onScrubChange,
      })
    : null;
  const grid = createGridOverlay(layer);
  const forced = createForcedStatePreview();
  const positionGuides: GuideChrome = createGuideChrome(layer);
  const sync = () => {
    const target = focusedTreeTarget(kernel);
    const element = target === undefined ? null : elementDomOf(index, target.nodeId, target.path);
    const node =
      target === undefined
        ? undefined
        : customCodeElementAt(kernel, target.nodeId, target.path)?.element;
    const rect = target === undefined ? undefined : index.elementRect?.(target.nodeId, target.path);
    const box =
      rect === undefined ? null : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    forced.apply(element ?? undefined, styleStateRef.current);
    const dragSession = machineryRef.current?.session ?? null;
    const showHandles =
      target !== undefined &&
      element !== null &&
      box !== null &&
      node !== undefined &&
      node.kind !== 'component' &&
      treeSessionRef.current === null &&
      (dragSession === null || dragSession.phase() === 'idle');
    handles?.update(
      showHandles ? target : null,
      showHandles ? element : null,
      showHandles ? box : null,
    );
    const metrics =
      activeSectorRef.current === 'layout' && element !== null
        ? readGridMetrics(element)
        : undefined;
    if (metrics !== undefined && box !== null) {
      grid.show(box, metrics, dirRef.current);
    } else {
      grid.hide();
    }
  };
  return { handles, grid, forced, positionGuides, sync };
}

// ── block-parts (2026-10-06) ──
/**
 * The floating bars anchor to a focused PART the way they anchor to a
 * focused element: the channel asks `elementRect` for the anchor path, and
 * the part sentinel path answers with the part's own rect (falling back to
 * the block's when the instance is gone).
 */
export function partAnchorIndex(kernel: BuilderKernel, index: RectIndex): RectIndex {
  return {
    ...index,
    elementRect: (id, path) => {
      const partFocus = kernel.context.store.getState().partFocus ?? null;
      if (path.length === 1 && path[0] === PART_ANCHOR_PATH[0]) {
        return partFocus !== null && partFocus.id === id
          ? index.partRect?.(id, partFocus)
          : undefined;
      }
      return index.elementRect?.(id, path);
    },
  };
}
// ── /block-parts ──
