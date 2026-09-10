import {
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
 */
export interface FloatingHostPorts {
  /** Element size in layer-local px. Injected in jsdom, which has no layout. */
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
    const size = ports.measure(element);
    if (size.width <= 0 || size.height <= 0) {
      // Not measurable yet (React has not painted the buttons). Stay hidden;
      // the size observer brings us straight back with a real measurement.
      hide();
      return;
    }
    const placement = positionFloating({
      anchor,
      size,
      frame: target.frame,
      viewport: target.viewport,
      ...(target.visible === undefined ? {} : { visible: target.visible }),
      dir: target.dir,
      ...(target.scale === undefined ? {} : { scale: target.scale }),
      ...(options.align === undefined ? {} : { align: options.align }),
      ...(options.prefer === undefined ? {} : { prefer: options.prefer }),
      ...(options.gap === undefined ? {} : { gap: options.gap }),
      ...(options.arrowSize === undefined ? {} : { arrowSize: options.arrowSize }),
    });
    current = placement;
    if (placement.hidden) {
      element.style.visibility = 'hidden';
      element.removeAttribute('data-placement');
      return;
    }
    // Physical coordinates on purpose — the same measured-geometry exception the
    // outlines take (logical insets would move the origin under RTL and corrupt
    // the math that already accounts for direction).
    element.style.transform = `translate(${String(Math.round(placement.x))}px, ${String(Math.round(placement.y))}px)`;
    element.style.setProperty('--bldr-arrow-x', `${String(Math.round(placement.arrowOffset))}px`);
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
