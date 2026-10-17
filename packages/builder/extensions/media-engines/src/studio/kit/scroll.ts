/*
  s.scroll for the scene kit (pixi-studio §B.2).

  - progress: 0 when the region's top meets the viewport's bottom, 1 when its bottom leaves the
    viewport's top (linear in between, clamped);
  - velocity: signed scroll speed in VIEWPORT HEIGHTS per second, smoothed and decaying to 0
    (a fast flick is around 2..6);
  - visible: the region intersects the viewport (fed by the kit's IntersectionObserver).
  Read once per tick plus on a passive scroll listener; never writes to the page.
*/

export interface SceneScroll {
  progress: number;
  velocity: number;
  visible: boolean;
}

export interface ScrollTracker {
  scroll: SceneScroll;
  update(dtSeconds: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

export function scrollProgress(top: number, height: number, viewport: number): number {
  const span = viewport + height;
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(1, (viewport - top) / span));
}

export function createScrollTracker(el: Element, win: Window): ScrollTracker {
  const scroll: SceneScroll = { progress: 0, velocity: 0, visible: true };
  let lastY = Number(win.scrollY) || 0;
  let pending = 0;

  function measure(): void {
    try {
      const rect = el.getBoundingClientRect();
      const viewport = win.innerHeight || el.ownerDocument.documentElement.clientHeight || 1;
      scroll.progress = scrollProgress(rect.top, rect.height, viewport);
    } catch {
      // Detached: keep the last value.
    }
  }

  function onScroll(): void {
    const y = Number(win.scrollY) || 0;
    pending += y - lastY;
    lastY = y;
    measure();
  }

  const options: AddEventListenerOptions = { passive: true };
  win.addEventListener('scroll', onScroll, options);
  measure();

  return {
    scroll,
    update(dtSeconds: number): void {
      const dt = Math.max(1 / 240, dtSeconds);
      const viewport = win.innerHeight || 1;
      const instant = pending / viewport / dt;
      pending = 0;
      // Rise fast, fall smoothly.
      const blend = Math.abs(instant) > Math.abs(scroll.velocity) ? 0.5 : 1 - Math.exp(-dt * 4);
      scroll.velocity += (instant - scroll.velocity) * blend;
      if (Math.abs(scroll.velocity) < 1e-3) scroll.velocity = 0;
      measure();
    },
    setVisible(visible: boolean): void {
      scroll.visible = visible;
    },
    dispose(): void {
      win.removeEventListener('scroll', onScroll, options);
    },
  };
}
