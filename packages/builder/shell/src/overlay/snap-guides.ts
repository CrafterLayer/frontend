import type { BuilderKernel } from '@craftkit/builder-core';
import {
  applyStyleIntents,
  readStyle,
  type StyleBucket,
  type StyleIntent,
  type StyleState,
  type StyleValue,
} from '@craftkit/builder-schema';

import { customCodeElementAt } from '../custom-code/element-at';
import {
  treeNodeDisplayName,
  tryDispatchTreeEdits,
  type ElementTarget,
} from '../custom-code/element-target';
import './overlay.css';

/*
  ── Snap guides, absolute positioning and nudges (style-manager DESIGN.md §A.6)

  Three canvas gestures share this module:

  - REORDER drags (tree drops) show the insertion line plus alignment guides
    along the edges the siblings share, so a person sees the column they are
    dropping into.
  - ABSOLUTE / FIXED elements are moved by dragging them: the preview is a
    canvas-DOM translate only; on release the engine writes `inset-*` (inline
    start + block start, logical) as ONE transaction. While dragging, the box
    snaps (6px) to its parent's and siblings' edges and centres, with guide
    lines.
  - NUDGES from the keyboard: 1px, Shift 10px; the inline arrows are mirrored
    under RTL (ArrowRight moves towards inline-start on an RTL page).

  Geometry here is measured, physical, layer-local — the same exception the
  outlines take. What is WRITTEN is logical.
*/

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A guide line in layer-local space; zero width or zero height. */
export interface GuideLine {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const SNAP_THRESHOLD = 6;

interface AxisCandidate {
  readonly delta: number;
  readonly at: number;
  readonly target: Box;
}

function edges(box: Box, axis: 'x' | 'y'): readonly number[] {
  return axis === 'x'
    ? [box.x, box.x + box.width / 2, box.x + box.width]
    : [box.y, box.y + box.height / 2, box.y + box.height];
}

function bestOnAxis(moving: Box, targets: readonly Box[], axis: 'x' | 'y', threshold: number) {
  let best: AxisCandidate | undefined;
  const own = edges(moving, axis);
  for (const target of targets) {
    for (const edge of edges(target, axis)) {
      for (const mine of own) {
        const delta = edge - mine;
        if (Math.abs(delta) > threshold) continue;
        if (best === undefined || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, at: edge, target };
        }
      }
    }
  }
  return best;
}

/**
 * Snap a moving box to the parent's and siblings' edges and centres. Returns
 * the correction to add to the drag delta and the guide lines to draw.
 */
export function computeSnap(
  moving: Box,
  targets: readonly Box[],
  threshold = SNAP_THRESHOLD,
): { readonly dx: number; readonly dy: number; readonly guides: readonly GuideLine[] } {
  const bx = bestOnAxis(moving, targets, 'x', threshold);
  const by = bestOnAxis(moving, targets, 'y', threshold);
  const guides: GuideLine[] = [];
  const dx = bx?.delta ?? 0;
  const dy = by?.delta ?? 0;
  if (bx !== undefined) {
    const top = Math.min(moving.y + dy, bx.target.y);
    const bottom = Math.max(moving.y + dy + moving.height, bx.target.y + bx.target.height);
    guides.push({ x: bx.at, y: top, width: 0, height: bottom - top });
  }
  if (by !== undefined) {
    const left = Math.min(moving.x + dx, by.target.x);
    const right = Math.max(moving.x + dx + moving.width, by.target.x + by.target.width);
    guides.push({ x: left, y: by.at, width: right - left, height: 0 });
  }
  return { dx, dy, guides };
}

/**
 * Alignment guides for a reorder drop: the start edges two or more siblings
 * share, drawn across the receiving container.
 */
export function alignmentGuides(siblings: readonly Box[], parent: Box | undefined): GuideLine[] {
  if (parent === undefined || siblings.length < 2) return [];
  const count = (values: readonly number[]) => {
    const map = new Map<number, number>();
    for (const value of values) map.set(Math.round(value), (map.get(Math.round(value)) ?? 0) + 1);
    return [...map.entries()].filter(([, n]) => n >= 2).map(([value]) => value);
  };
  const xs = count(siblings.flatMap((box) => [box.x, box.x + box.width]));
  const ys = count(siblings.flatMap((box) => [box.y, box.y + box.height]));
  return [
    ...xs.map((x) => ({ x, y: parent.y, width: 0, height: parent.height })),
    ...ys.map((y) => ({ x: parent.x, y, width: parent.width, height: 0 })),
  ];
}

export interface GuideChrome {
  show(lines: readonly GuideLine[]): void;
  hide(): void;
  dispose(): void;
}

/** Pooled guide-line elements in the overlay layer (no allocation per move once warm). */
export function createGuideChrome(layer: HTMLElement): GuideChrome {
  const pool: HTMLElement[] = [];
  const hide = () => {
    for (const line of pool) line.style.visibility = 'hidden';
  };
  return {
    show(lines) {
      while (pool.length < lines.length) {
        const line = layer.ownerDocument.createElement('div');
        line.className = 'bldr-snap-guide';
        line.setAttribute('aria-hidden', 'true');
        layer.append(line);
        pool.push(line);
      }
      pool.forEach((element, at) => {
        const line = lines[at];
        if (line === undefined) {
          element.style.visibility = 'hidden';
          return;
        }
        element.style.transform = `translate(${String(line.x)}px, ${String(line.y)}px)`;
        element.style.width = `${String(Math.max(line.width, 1))}px`;
        element.style.height = `${String(Math.max(line.height, 1))}px`;
        element.style.visibility = 'visible';
      });
    },
    hide,
    dispose() {
      for (const line of pool) line.remove();
      pool.length = 0;
    },
  };
}

// ── Nudges ─────────────────────────────────────────────────────────────────

const NUDGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export function isNudgeKey(key: string): boolean {
  return NUDGE_KEYS.has(key);
}

function pxOf(value: StyleValue | undefined): number {
  if (value === undefined) return 0;
  if (value.kind === 'raw') {
    const match = /^(-?\d*\.?\d+)px$/u.exec(value.css.trim());
    return match === null ? 0 : Number(match[1]);
  }
  if (value.kind === 'token') {
    if (value.token === 'px') return 1;
    if (value.token === '-px') return -1;
    const steps = Number(value.token);
    return Number.isFinite(steps) ? steps * 4 : 0;
  }
  return 0;
}

function rawPx(amount: number): StyleValue {
  return { kind: 'raw', css: `${String(Math.round(amount))}px` };
}

/**
 * The inset intents that move an element by a physical delta. The inline
 * axis is written as inset-inline-start, so on an RTL page moving RIGHT
 * shrinks inline-start (it is measured from the right edge).
 */
export function insetMoveIntents(
  className: string,
  delta: { readonly dx: number; readonly dy: number },
  at: { readonly bucket: StyleBucket; readonly state: StyleState; readonly dir: 'ltr' | 'rtl' },
  /**
   * The offsets the canvas actually shows, when known: a physical `left-4`
   * the engine would replace reads as nothing, and starting from 0 would
   * make the element jump.
   */
  measured?: { readonly inlineStart: number; readonly blockStart: number }  ,
): StyleIntent[] {
  const reading = readStyle(className, { bucket: at.bucket, state: at.state }).get('inset');
  const side = (name: 'inline-start' | 'block-start') => {
    if (measured !== undefined) return name === 'inline-start' ? measured.inlineStart : measured.blockStart;
    return pxOf(reading?.sides?.[name]?.value ?? reading?.value);
  };
  const intents: StyleIntent[] = [];
  if (delta.dx !== 0) {
    const inline = at.dir === 'rtl' ? -delta.dx : delta.dx;
    intents.push({
      property: 'inset',
      side: 'inline-start',
      value: rawPx(side('inline-start') + inline),
      bucket: at.bucket,
      state: at.state,
    });
  }
  if (delta.dy !== 0) {
    intents.push({
      property: 'inset',
      side: 'block-start',
      value: rawPx(side('block-start') + delta.dy),
      bucket: at.bucket,
      state: at.state,
    });
  }
  return intents;
}

/** The physical delta of an arrow key: 1px, Shift 10px. */
export function nudgeDelta(key: string, shift: boolean): { dx: number; dy: number } {
  const step = shift ? 10 : 1;
  switch (key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return { dx: 0, dy: 0 };
  }
}

export interface MoveElementOptions {
  readonly bucket?: StyleBucket | undefined;
  readonly state?: StyleState | undefined;
  /** The PAGE direction. */
  readonly dir: 'ltr' | 'rtl';
  readonly label?: string | undefined;
  /** The element's current offsets as the canvas shows them (see `measuredInsets`). */
  readonly measured?: { readonly inlineStart: number; readonly blockStart: number } | undefined;
}

/**
 * Move a positioned tree element by a physical delta as ONE labelled
 * transaction (nudge or drag release). Returns the announcement.
 */
export function moveTreeElementBy(
  kernel: BuilderKernel,
  target: Extract<ElementTarget, { kind: 'tree' }>,
  delta: { readonly dx: number; readonly dy: number },
  options: MoveElementOptions,
): { readonly ok: boolean; readonly announcement: string } {
  const found = customCodeElementAt(kernel, target.nodeId, target.path);
  if (found === undefined || found.element.kind === 'component') {
    return { ok: false, announcement: 'The element can no longer be moved' };
  }
  const className = found.element.className ?? '';
  const intents = insetMoveIntents(className, delta, {
    bucket: options.bucket ?? 'base',
    state: options.state ?? 'default',
    dir: options.dir,
  }, options.measured);
  if (intents.length === 0) return { ok: true, announcement: 'Kept in place' };
  const next = applyStyleIntents(className, intents, { mode: 'free' });
  if (!next.ok) return { ok: false, announcement: next.message };
  const name = treeNodeDisplayName(found.element);
  const result = tryDispatchTreeEdits(
    kernel,
    [
      {
        command: 'patchTreeNode',
        args: { id: target.nodeId, path: [...target.path], set: { className: next.className } },
      },
    ],
    `${options.label ?? 'Position'} · ${name}`,
  );
  return result.ok
    ? { ok: true, announcement: `Moved ${name}` }
    : { ok: false, announcement: result.message };
}

/** The inline-start / block-start offsets a positioned canvas element shows, in px. */
export function measuredInsets(
  element: HTMLElement,
  dir: 'ltr' | 'rtl',
): { inlineStart: number; blockStart: number } | undefined {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style === undefined) return undefined;
  const read = (value: string) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : undefined;
  };
  const inline = read(dir === 'rtl' ? style.right : style.left);
  const block = read(style.top);
  return inline === undefined || block === undefined ? undefined : { inlineStart: inline, blockStart: block };
}

/** Whether a canvas element is taken out of flow (absolute or fixed) — the ones that move freely. */
export function isFreelyPositioned(element: HTMLElement): boolean {
  const position = element.ownerDocument.defaultView?.getComputedStyle(element).position ?? '';
  return position === 'absolute' || position === 'fixed';
}
