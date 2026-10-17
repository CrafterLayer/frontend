import EmblaCarousel, { type EmblaOptionsType, type EmblaCarouselType } from 'embla-carousel';

/** Never reparent a node: interactive previews, like the canvas, can be owned by React. */
export function createCarouselEngine(
  track: HTMLElement,
  options: EmblaOptionsType,
): EmblaCarouselType {
  const parent = track.parentElement;
  if (parent === null) throw new Error('A carousel track needs a viewport parent.');
  const viewport = parent;
  const viewportMarker = viewport.getAttribute('data-ck-embla-viewport');
  viewport.setAttribute('data-ck-embla-viewport', '');
  const scroll = track.scrollLeft;
  const transform = track.style.getPropertyValue('transform');
  const transformPriority = track.style.getPropertyPriority('transform');
  const styles = [
    { el: track, name: 'overflow-x', applied: 'visible' },
    { el: track, name: 'scroll-snap-type', applied: 'none' },
    { el: track, name: 'display', applied: 'flex' },
    { el: viewport, name: 'overflow-x', applied: 'hidden' },
    { el: viewport, name: 'touch-action', applied: 'pan-y pinch-zoom' },
  ].map((entry) => ({
    ...entry,
    value: entry.el.style.getPropertyValue(entry.name),
    priority: entry.el.style.getPropertyPriority(entry.name),
  }));
  let engine: EmblaCarouselType | undefined;
  let disposed = false;
  function restore(): void {
    if (disposed) return;
    disposed = true;
    const translated = track.style.getPropertyValue('transform');
    engine?.destroy();
    // Embla clears its translate on destroy. Restore a pre-existing authored transform.
    if (translated.startsWith('translate3d(') || translated === '') {
      if (transform !== '') track.style.setProperty('transform', transform, transformPriority);
    } else if (translated !== '') track.style.setProperty('transform', translated);
    styles.forEach((entry) => {
      if (entry.el.style.getPropertyValue(entry.name) !== entry.applied) return;
      if (entry.value === '') entry.el.style.removeProperty(entry.name);
      else entry.el.style.setProperty(entry.name, entry.value, entry.priority);
    });
    if (viewport.getAttribute('data-ck-embla-viewport') === '') {
      if (viewportMarker === null) viewport.removeAttribute('data-ck-embla-viewport');
      else viewport.setAttribute('data-ck-embla-viewport', viewportMarker);
    }
    track.scrollLeft = scroll;
  }
  try {
    styles.forEach((entry) => {
      entry.el.style.setProperty(entry.name, entry.applied);
    });
    track.scrollLeft = 0;
    engine = EmblaCarousel(viewport, {
      ...options,
      container: track,
      align: 'start',
      containScroll: false,
      loop: false,
      watchSlides: false,
      watchDrag: (_api, event) => track.contains(event.target as Node | null),
    });
    return { ...engine, destroy: restore };
  } catch (cause) {
    restore();
    throw cause;
  }
}
