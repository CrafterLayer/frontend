import type { BuilderKernel } from '@craftkit/builder-core';
import {
  applyStyleIntents,
  SPACING_SCALE,
  type StyleBoxSide,
  type StyleBucket,
  type StyleIntent,
  type StyleSide,
  type StyleState,
  type StyleValue,
} from '@craftkit/builder-schema';

import { customCodeElementAt } from '../custom-code/element-at';
import {
  treeNodeDisplayName,
  tryDispatchTreeEdits,
  type ElementTarget,
} from '../custom-code/element-target';
import { BOX_SIDES, sideForModifiers } from '../style-manager/box-sides';
import { scrubValue } from '../style-manager/controls/BoxSideButton';
import { spacingModel } from '../style-manager/controls/ScaleNumberControl';
import './overlay.css';

/*
  ── Spacing handles on the canvas (style-manager DESIGN.md §A.6, P7) ─────────

  Over the focused element, a band per LOGICAL side for padding (inside the
  box) and margin (outside it), drawn from the sizes the canvas actually
  shows. Dragging a band scrubs that side:

  - the preview swaps classes on the element's canvas DOM ONLY (the live
    compiler follows class changes), snapping to the spacing scale, with a
    value badge — the document is not written while the pointer moves;
  - Shift scrubs all four sides, Alt the opposite pair (the box-model rules);
  - release commits ONE labelled transaction ("Padding · Heading …") through
    the P1 engine and `patchTreeNode`; Escape or a cancelled pointer puts the
    DOM back and writes nothing.

  Bands are measured geometry in layer-local px (physical, like the outlines);
  inline-start sits on the right of an RTL page.
*/

export type HandleProperty = 'padding' | 'margin';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type TreeTarget = Extract<ElementTarget, { kind: 'tree' }>;

/** The smallest grabbable band, in px, when the side's own size is smaller. */
const MIN_BAND = 6;

const MODEL = spacingModel(SPACING_SCALE);

/** Physical side of a logical box side on a horizontal page. */
function physicalOf(side: StyleBoxSide, dir: 'ltr' | 'rtl'): 'top' | 'bottom' | 'left' | 'right' {
  switch (side) {
    case 'block-start':
      return 'top';
    case 'block-end':
      return 'bottom';
    case 'inline-start':
      return dir === 'rtl' ? 'right' : 'left';
    case 'inline-end':
      return dir === 'rtl' ? 'left' : 'right';
  }
}

function cssPx(style: CSSStyleDeclaration | undefined, name: string): number {
  const value = Number.parseFloat(style?.getPropertyValue(name) ?? '');
  return Number.isFinite(value) ? value : 0;
}

/** The band of one side, layer-local. Padding lies inside the rect, margin outside. */
export function bandRect(
  rect: Box,
  property: HandleProperty,
  physical: 'top' | 'bottom' | 'left' | 'right',
  size: number,
): Box {
  const thickness = Math.max(size, MIN_BAND);
  const inside = property === 'padding';
  switch (physical) {
    case 'top':
      return { x: rect.x, y: inside ? rect.y : rect.y - thickness, width: rect.width, height: thickness };
    case 'bottom':
      return {
        x: rect.x,
        y: inside ? rect.y + rect.height - thickness : rect.y + rect.height,
        width: rect.width,
        height: thickness,
      };
    case 'left':
      return { x: inside ? rect.x : rect.x - thickness, y: rect.y, width: thickness, height: rect.height };
    case 'right':
      return {
        x: inside ? rect.x + rect.width - thickness : rect.x + rect.width,
        y: rect.y,
        width: thickness,
        height: rect.height,
      };
  }
}

function valueText(value: StyleValue): string {
  if (value.kind === 'token') {
    const amount = MODEL.amountOf(value.token);
    return amount === undefined ? value.token : `${String(amount.amount)}px · ${value.token}`;
  }
  return value.kind === 'raw' ? value.css : '';
}

export interface ElementHandlesOptions {
  readonly layer: HTMLElement;
  readonly kernel: BuilderKernel;
  readonly bucket: () => StyleBucket;
  readonly state: () => StyleState;
  /** The PAGE direction. */
  readonly dir: () => 'ltr' | 'rtl';
  /** Host px per layer px (canvas zoom). */
  readonly scale: () => number;
  readonly announce: (message: string) => void;
  /** Called when a scrub starts and ends (the canvas hides the quick bar meanwhile). */
  readonly onScrubChange?: ((active: boolean) => void) | undefined;
}

export interface ElementHandles {
  /** Place the bands over `element` (the target's canvas DOM) at `rect`; null hides them. */
  update(target: TreeTarget | null, element: HTMLElement | null, rect: Box | null): void;
  isScrubbing(): boolean;
  /** Abandon a scrub in flight (Escape): the DOM is put back, nothing is written. */
  cancel(): void;
  dispose(): void;
}

interface Scrub {
  readonly pointerId: number;
  readonly band: HTMLElement;
  readonly property: HandleProperty;
  readonly side: StyleBoxSide;
  readonly startX: number;
  readonly startY: number;
  readonly start: StyleValue;
  readonly target: TreeTarget;
  readonly element: HTMLElement;
  readonly originalClass: string;
  intents: StyleIntent[] | null;
}

export function createElementHandles(options: ElementHandlesOptions): ElementHandles {
  const { layer, kernel } = options;
  const doc = layer.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'bldr-box-handles';
  root.setAttribute('aria-hidden', 'true');
  root.style.visibility = 'hidden';
  const badge = doc.createElement('div');
  badge.className = 'bldr-box-badge';
  badge.style.visibility = 'hidden';
  const bands = new Map<string, HTMLElement>();
  for (const property of ['margin', 'padding'] as const) {
    for (const side of BOX_SIDES) {
      const band = doc.createElement('div');
      band.className = `bldr-box-band bldr-box-band--${property}`;
      band.dataset['property'] = property;
      band.dataset['side'] = side;
      root.append(band);
      bands.set(`${property}:${side}`, band);
    }
  }
  root.append(badge);
  layer.append(root);

  let current: { target: TreeTarget; element: HTMLElement; rect: Box } | null = null;
  let scrub: Scrub | null = null;

  const restore = (active: Scrub) => {
    active.element.className = active.originalClass;
    badge.style.visibility = 'hidden';
  };

  const end = (active: Scrub) => {
    scrub = null;
    active.band.removeAttribute('data-active');
    if (active.band.hasPointerCapture(active.pointerId)) {
      active.band.releasePointerCapture(active.pointerId);
    }
    options.onScrubChange?.(false);
  };

  const intentsFor = (active: Scrub, event: PointerEvent): StyleIntent[] => {
    const scale = options.scale() > 0 ? options.scale() : 1;
    const delta = { dx: (event.clientX - active.startX) / scale, dy: (event.clientY - active.startY) / scale };
    const group: StyleSide = sideForModifiers(active.side, { all: event.shiftKey, pair: event.altKey });
    const value = scrubValue(
      MODEL,
      active.start,
      active.side,
      delta,
      options.dir(),
      active.property === 'margin' ? -400 : 0,
    );
    return [
      {
        property: active.property,
        side: group,
        value,
        bucket: options.bucket(),
        state: options.state(),
      },
    ];
  };

  const onPointerDown = (event: PointerEvent) => {
    const band = event.currentTarget as HTMLElement;
    if (event.button !== 0 || current === null || scrub !== null) return;
    const property = band.dataset['property'] as HandleProperty;
    const side = band.dataset['side'] as StyleBoxSide;
    event.preventDefault();
    event.stopPropagation();
    const style = current.element.ownerDocument.defaultView?.getComputedStyle(current.element);
    const shown = cssPx(style, `${property}-${physicalOf(side, options.dir())}`);
    scrub = {
      pointerId: event.pointerId,
      band,
      property,
      side,
      startX: event.clientX,
      startY: event.clientY,
      start: { kind: 'raw', css: `${String(Math.round(shown))}px` },
      target: current.target,
      element: current.element,
      originalClass: current.element.className,
      intents: null,
    };
    band.setAttribute('data-active', '');
    band.setPointerCapture(event.pointerId);
    options.onScrubChange?.(true);
  };

  const onPointerMove = (event: PointerEvent) => {
    const active = scrub;
    if (active?.pointerId !== event.pointerId) return;
    const intents = intentsFor(active, event);
    // Preview: classes on the canvas DOM only. The engine works on whatever
    // the DOM shows (named styles already expanded), so the swap is exact.
    const preview = applyStyleIntents(active.originalClass, intents, { mode: 'free' });
    if (!preview.ok) return;
    active.intents = intents;
    active.element.className = preview.className;
    const value = intents[0]?.value;
    if (value !== undefined && value !== null) {
      badge.textContent = valueText(value);
      const rect = active.band.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const scale = options.scale() > 0 ? options.scale() : 1;
      badge.style.transform = `translate(${String((rect.x - layerRect.x) / scale)}px, ${String((rect.y - layerRect.y) / scale - 22)}px)`;
      badge.style.visibility = 'visible';
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const active = scrub;
    if (active?.pointerId !== event.pointerId) return;
    restore(active);
    end(active);
    const intents = active.intents;
    if (intents === null) return; // a press without travel writes nothing
    const found = customCodeElementAt(kernel, active.target.nodeId, active.target.path);
    if (found === undefined || found.element.kind === 'component') {
      options.announce('The element no longer exists');
      return;
    }
    const stored = found.element.className ?? '';
    const next = applyStyleIntents(stored, intents, { mode: 'free' });
    if (!next.ok) {
      options.announce(next.message);
      return;
    }
    if (next.className === stored) return;
    const name = treeNodeDisplayName(found.element);
    const word = active.property === 'padding' ? 'Padding' : 'Margin';
    const result = tryDispatchTreeEdits(
      kernel,
      [
        {
          command: 'patchTreeNode',
          args: {
            id: active.target.nodeId,
            path: [...active.target.path],
            set: { className: next.className === '' ? null : next.className },
          },
        },
      ],
      `${word} · ${name}`,
    );
    options.announce(result.ok ? `${word} changed on ${name}` : result.message);
  };

  const onPointerCancel = (event: PointerEvent) => {
    const active = scrub;
    if (active?.pointerId !== event.pointerId) return;
    restore(active);
    end(active);
  };

  for (const band of bands.values()) {
    band.addEventListener('pointerdown', onPointerDown);
    band.addEventListener('pointermove', onPointerMove);
    band.addEventListener('pointerup', onPointerUp);
    band.addEventListener('pointercancel', onPointerCancel);
  }

  return {
    update(target, element, rect) {
      if (scrub !== null) return; // geometry is frozen while scrubbing
      if (target === null || element === null || rect === null) {
        current = null;
        root.style.visibility = 'hidden';
        return;
      }
      current = { target, element, rect };
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      const dir = options.dir();
      for (const property of ['margin', 'padding'] as const) {
        for (const side of BOX_SIDES) {
          const physical = physicalOf(side, dir);
          const band = bands.get(`${property}:${side}`);
          /* v8 ignore next -- every band is created above. */
          if (band === undefined) continue;
          const box = bandRect(rect, property, physical, cssPx(style, `${property}-${physical}`));
          band.style.transform = `translate(${String(box.x)}px, ${String(box.y)}px)`;
          band.style.width = `${String(box.width)}px`;
          band.style.height = `${String(box.height)}px`;
          band.dataset['physical'] = physical;
        }
      }
      root.style.visibility = 'visible';
    },
    isScrubbing: () => scrub !== null,
    cancel() {
      const active = scrub;
      if (active === null) return;
      restore(active);
      end(active);
    },
    dispose() {
      const active = scrub;
      if (active !== null) restore(active);
      for (const band of bands.values()) {
        band.removeEventListener('pointerdown', onPointerDown);
        band.removeEventListener('pointermove', onPointerMove);
        band.removeEventListener('pointerup', onPointerUp);
        band.removeEventListener('pointercancel', onPointerCancel);
      }
      root.remove();
    },
  };
}
