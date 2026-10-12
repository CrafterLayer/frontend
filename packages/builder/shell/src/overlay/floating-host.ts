import {
  FLOATING_GAP,
  FLOATING_PADDING,
  positionFloating,
  type FloatingAnchor,
  type FloatingBox,
  type FloatingPlacement,
} from './floating-position';

/**
 * The imperative home of a floating toolbar (009 contract §2/§7).
 *
 * A floating bar has two halves that must NOT share a rhythm:
 *
 *   its CONTENT  — which buttons, which are pressed — changes when the document
 *                  or the selection changes, and belongs to React;
 *   its POSITION — changes on every scroll, resize, and reflow, and must never
 *                  reach React at all.
 *
 * So React portals the toolbar INTO this host's element and never positions it;
 * the host writes `transform` straight onto that element from the anchor
 * channel, exactly as the outline chrome does. Scrolling a canvas with an open
 * toolbar therefore renders zero components (SC-002) — the property a bar that
 * recomputes its style in render cannot have.
 *
 * Size is measured, not assumed: a toolbar whose buttons change width would
 * otherwise stay centred on its old width. The host observes its own element and
 * re-places from the last input, which is also what makes the first paint
 * correct — React mounts the buttons, the observer reports a real size, and the
 * bar lands measured rather than at 0×0.
 *
 * Chrome stays CHROME-sized under canvas zoom. The layer this host lives in
 * shares the frame's `scale(zoom)`, so an uncompensated bar shrank with the
 * page (at a 0.57 "Fit" its 36px targets drew ~20px — under the 24px minimum).
 * The host undoes the zoom with `scale(1 / zoom)` folded into the same
 * transform, so its own px ARE host px; placement still runs layer-local, so
 * every chrome distance is divided by the zoom on the way in.
 */
export interface FloatingHostPorts {
  /**
   * Element size in its OWN px — host px, since the host counter-scales the
   * canvas zoom. Injected in jsdom, which has no layout.
   */
  measure: (element: HTMLElement) => { width: number; height: number };
  /** Size-change subscription; returns its own detach. */
  observe: (element: HTMLElement, onResize: () => void) => () => void;
}

export interface FloatingHostOptions {
  layer: HTMLElement;
  /** Extra class on the host element, for the toolbar's own skin. */
  className?: string;
  align?: 'center' | 'start';
  prefer?: 'above' | 'below';
  gap?: number;
  arrowSize?: number;
  // ── block-parts (2026-10-06) ── see FloatingInput.keepClear
  keepClear?: boolean;
  // ── /block-parts ──
  ports?: Partial<FloatingHostPorts>;
}

export interface FloatingTarget {
  anchor: FloatingBox | FloatingAnchor | null;
  frame: FloatingBox;
  viewport: { width: number; height: number };
  visible?: { width: number; height: number };
  dir: 'ltr' | 'rtl';
  /** Host pixels per one layer-local pixel. */
  scale?: number;
}

export interface FloatingHost {
  /** The portal target: React renders the toolbar's content in here. */
  readonly element: HTMLElement;
  /** Position against a new target; a null anchor hides the bar. */
  place: (target: FloatingTarget) => void;
  /** Re-run the last placement (used by the size observer). */
  reposition: () => void;
  /** The last applied placement — null while hidden. Test/debug surface. */
  placement: () => FloatingPlacement | null;
  dispose: () => void;
}

export function systemFloatingPorts(): FloatingHostPorts {
  return {
    measure: (element) => {
      // ── block-parts (2026-10-06) ──
      // The layout box: the element's own px, which no transform changes.
      // (Before the counter-scale the client rect was zoomed — at 73% a 62px
      // two-row bar measured 45 and was placed over its own part.)
      if (element.offsetWidth > 0 && element.offsetHeight > 0) {
        return { width: element.offsetWidth, height: element.offsetHeight };
      }
      // ── /block-parts ──
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    },
    observe: (element, onResize) => {
      /* v8 ignore next 3 -- jsdom injects ports; browsers always have RO. */
      if (typeof ResizeObserver === 'undefined') {
        return () => undefined;
      }
      const observer = new ResizeObserver(onResize);
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    },
  };
}

export function createFloatingHost(options: FloatingHostOptions): FloatingHost {
  const ports = { ...systemFloatingPorts(), ...options.ports };
  const element = options.layer.ownerDocument.createElement('div');
  element.className =
    options.className === undefined ? 'bldr-floating' : `bldr-floating ${options.className}`;
  // Hidden until placed: a toolbar must never flash at the layer's origin
  // before its first measurement lands.
  element.style.visibility = 'hidden';
  options.layer.append(element);

  let last: FloatingTarget | null = null;
  let current: FloatingPlacement | null = null;
  let disposed = false;

  const hide = () => {
    current = null;
    element.style.visibility = 'hidden';
    element.removeAttribute('data-placement');
  };

  const apply = () => {
    const target = last;
    const anchor = target?.anchor ?? null;
    if (disposed || anchor === null || target === null) {
      hide();
      return;
    }
    const own = ports.measure(element);
    if (own.width <= 0 || own.height <= 0) {
      // Not measurable yet (React has not painted the buttons). Stay hidden;
      // the size observer brings us straight back with a real measurement.
      hide();
      return;
    }
    // Host px per layer-local px. Chrome distances (own size, gap, padding,
    // arrow) are host px, so each enters the layer-local math divided by it.
    const s =
      target.scale !== undefined && Number.isFinite(target.scale) && target.scale > 0
        ? target.scale
        : 1;
    const placement = positionFloating({
      anchor,
      size: { width: own.width / s, height: own.height / s },
      frame: target.frame,
      viewport: target.viewport,
      ...(target.visible === undefined ? {} : { visible: target.visible }),
      dir: target.dir,
      scale: s,
      ...(options.align === undefined ? {} : { align: options.align }),
      ...(options.prefer === undefined ? {} : { prefer: options.prefer }),
      gap: (options.gap ?? FLOATING_GAP) / s,
      padding: FLOATING_PADDING / s,
      ...(options.arrowSize === undefined ? {} : { arrowSize: options.arrowSize / s }),
      // ── block-parts (2026-10-06) ──
      ...(options.keepClear === true ? { keepClear: true } : {}),
      // ── /block-parts ──
    });
    current = placement;
    if (placement.hidden) {
      element.style.visibility = 'hidden';
      element.removeAttribute('data-placement');
      return;
    }
    // Physical coordinates on purpose — the same measured-geometry exception the
    // outlines take (logical insets would move the origin under RTL and corrupt
    // the math that already accounts for direction). Whole HOST px: a half-pixel
    // transform blurs text. The counter-scale is folded into the SAME transform
    // (after the translate, so it scales only the bar); the separate `scale`
    // property would scale the translate too. The arrow is drawn inside the
    // counter-scaled bar, so its offset goes back out in host px.
    const at = (value: number) => String(Math.round(value * s) / s);
    const counter = s === 1 ? '' : ` scale(${String(1 / s)})`;
    element.style.transform = `translate(${at(placement.x)}px, ${at(placement.y)}px)${counter}`;
    element.style.setProperty(
      '--bldr-arrow-x',
      `${String(Math.round(placement.arrowOffset * s))}px`,
    );
    element.dataset['placement'] = placement.placement;
    element.style.visibility = 'visible';
  };

  const offResize = ports.observe(element, apply);

  return {
    element,
    place: (target) => {
      last = target;
      apply();
    },
    reposition: apply,
    placement: () => current,
    dispose: () => {
      disposed = true;
      offResize();
      element.remove();
    },
  };
}
