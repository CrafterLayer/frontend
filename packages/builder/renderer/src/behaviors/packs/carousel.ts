/**
 * The `carousel` behaviour (media-motion DESIGN §B.3, D2), moved out of
 * `runtime.ts` and extended.
 *
 * ## The ported core (unchanged)
 *
 * The vocabulary admits no `data-ck-carousel-prev/next`, so the parts are
 * DERIVED: the track is the first element child that is not a button or a row
 * of buttons, and the buttons are every `<button>` inside the carousel but
 * outside the track — the first is "previous", the last is "next". The first
 * button sits at the inline start (the right in RTL), so it always means
 * "back"; what flips in RTL is the physical scroll direction. A step is 85% of
 * the track's width, smooth unless the visitor prefers reduced motion.
 *
 * ## The additions (closed params)
 *
 * - `data-ck-indicator="dots"`: one button per slide, labelled «الشريحة ٢ من ٥»
 *   / "Slide 2 of 5", the current one `aria-current="true"`.
 *   `data-ck-indicator="counter"`: «٢ / ٥» in a polite live region.
 *   `none` (or absent): nothing.
 * - `data-ck-autoplay="true"`: advances one slide every `data-ck-speed`
 *   (slow 7 s, normal 5 s, fast 3.5 s) and wraps at the end. A visible
 *   pause/play button comes with it (WCAG 2.2.2). It pauses while the pointer
 *   is over the carousel, while focus is inside it, and while it is off
 *   screen. Never under reduced motion, never on the editing canvas.
 * - The current slide is read from `scrollLeft`, normalised for RTL (Chrome
 *   and Firefox report a negative `scrollLeft` there).
 *
 * The built controls sit in one `[data-ck-carousel-ui]` row after the track.
 * On the canvas (`interactive: false`) they are drawn but inert, so a click
 * selects the element.
 *
 * Self-contained and serialisable like `mountBehaviors`: no imports, no
 * module-scope reads. Idempotent per element; the disposer removes the built
 * row, every listener, timer and observer, and restores each attribute the
 * host has not rewritten.
 */
export function mountCarousel(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null) {
    return function noop() {
      // Nothing was mounted, so there is nothing to undo.
    };
  }
  const view: Window = win;
  const page: Document = doc;
  const interactive = options?.interactive !== false;
  const still = !interactive;
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MARK = 'data-ck-mounted';
  const KEY = '__ckCarousel';
  const SELECTOR = "[data-ck-behavior='carousel']";
  const cleanups: (() => void)[] = [];

  const saved: { el: Element; name: string; original: string | null; applied: string | null }[] =
    [];
  function setAttr(el: Element, name: string, value: string | null): void {
    let entry = null as (typeof saved)[number] | null;
    for (const item of saved) {
      if (item.el === el && item.name === name) entry = item;
    }
    if (entry === null) {
      entry = { el, name, original: el.getAttribute(name), applied: null };
      saved.push(entry);
    }
    entry.applied = value;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
  function restoreAttrs(): void {
    for (let at = saved.length - 1; at >= 0; at -= 1) {
      const item = saved[at];
      if (item === undefined) continue;
      if (item.el.getAttribute(item.name) !== item.applied) continue;
      if (item.original === null) item.el.removeAttribute(item.name);
      else item.el.setAttribute(item.name, item.original);
    }
    saved.length = 0;
  }

  function listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    passive?: boolean,
  ): void {
    const opts: AddEventListenerOptions | boolean = passive === true ? { passive: true } : false;
    target.addEventListener(type, handler, opts);
    cleanups.push(function unlisten() {
      target.removeEventListener(type, handler, opts);
    });
  }

  function isRtl(el: Element): boolean {
    let computed = '';
    try {
      computed = view.getComputedStyle(el).direction;
    } catch {
      computed = '';
    }
    if (computed === 'rtl') return true;
    const owner = el.closest('[dir]');
    const written = owner === null ? '' : (owner.getAttribute('dir') ?? '').toLowerCase();
    if (written === 'rtl') return true;
    if (written === 'ltr') return false;
    return (page.documentElement.getAttribute('dir') ?? '').toLowerCase() === 'rtl';
  }

  function langOf(el: Element): string {
    const owner = el.closest('[lang]');
    const lang = owner === null ? '' : (owner.getAttribute('lang') ?? '');
    const chosen = lang !== '' ? lang : page.documentElement.lang;
    if (
      /^ar(?:-|$)/iu.test(chosen) &&
      !/-u-/iu.test(chosen) &&
      !/^ar-(?:MA|DZ|TN|LY|EH)\b/iu.test(chosen)
    ) {
      return `${chosen}-u-nu-arab`;
    }
    return chosen;
  }

  function digits(lang: string, value: number): string {
    try {
      return new Intl.NumberFormat(lang === '' ? undefined : lang, { useGrouping: false }).format(
        value,
      );
    } catch {
      return String(value);
    }
  }

  function mountOne(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    flag[KEY] = true;
    cleanups.push(function unflag() {
      Reflect.deleteProperty(flag, KEY);
    });
    const rtl = isRtl(el);

    let track: Element = el;
    for (const child of Array.from(el.children)) {
      if (child.tagName === 'BUTTON') continue;
      const kids = Array.from(child.children);
      if (kids.length > 0 && kids.every((kid) => kid.tagName === 'BUTTON')) continue;
      track = child;
      break;
    }
    setAttr(track, 'data-ck-track', '');
    if (track.getAttribute('tabindex') === null) setAttr(track, 'tabindex', '0');
    const buttons = Array.from(el.querySelectorAll('button')).filter(
      (button) => track === el || !track.contains(button),
    );
    const prev = buttons.length >= 2 ? buttons[0] : undefined;
    const next = buttons.length >= 2 ? buttons[buttons.length - 1] : undefined;
    const scroller = track as HTMLElement & { scrollBy?: unknown; scrollTo?: unknown };
    interface SnapEngine {
      scrollPrev(jump?: boolean): void;
      scrollNext(jump?: boolean): void;
      scrollTo(index: number, jump?: boolean): void;
      selectedScrollSnap(): number;
      on(event: 'select' | 'reInit', callback: () => void): void;
      destroy(): void;
    }
    type SnapFactory = (track: HTMLElement, options: Record<string, unknown>) => SnapEngine;
    let engine: SnapEngine | undefined;
    function go(forward: boolean): void {
      if (engine !== undefined) {
        if (forward) engine.scrollNext(reduced);
        else engine.scrollPrev(reduced);
        return;
      }
      const step = Math.max(160, scroller.clientWidth * 0.85 || 0);
      const sign = (forward ? 1 : -1) * (rtl ? -1 : 1);
      if (typeof scroller.scrollBy === 'function') {
        scroller.scrollBy({ left: sign * step, behavior: reduced ? 'auto' : 'smooth' });
      } else {
        scroller.scrollLeft += sign * step;
      }
    }
    if (prev !== undefined)
      listen(prev, 'click', () => {
        go(false);
      });
    if (next !== undefined)
      listen(next, 'click', () => {
        go(true);
      });

    const slides = Array.from(track.children).filter(
      (child) => !child.hasAttribute('data-ck-clone') && child.tagName !== 'BUTTON',
    ) as HTMLElement[];
    const count = slides.length;
    function stride(): number {
      const first = slides[0];
      const second = slides[1];
      if (first !== undefined && second !== undefined) {
        const apart = Math.abs(second.offsetLeft - first.offsetLeft);
        if (apart > 0) return apart;
      }
      const width = first === undefined ? 0 : first.offsetWidth;
      return width > 0 ? width : scroller.clientWidth;
    }
    function current(): number {
      if (engine !== undefined) return engine.selectedScrollSnap();
      if (count <= 1) return 0;
      const at = Math.abs(scroller.scrollLeft);
      const end = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      if (end > 0 && at >= end - 2) return count - 1;
      const step = stride();
      if (!Number.isFinite(step) || step <= 0) return 0;
      return Math.min(count - 1, Math.max(0, Math.round(at / step)));
    }
    function goTo(target: number): void {
      if (engine !== undefined) {
        engine.scrollTo(target, reduced);
        return;
      }
      const left = (rtl ? -1 : 1) * Math.max(0, target) * stride();
      if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
      } else {
        scroller.scrollLeft = left;
      }
    }

    const lang = langOf(el);
    const arabic = lang.toLowerCase().startsWith('ar');
    const indicator = el.getAttribute('data-ck-indicator');
    const autoplay =
      el.getAttribute('data-ck-autoplay') === 'true' && !reduced && !still && count > 1;
    const ui = page.createElement('div');
    ui.setAttribute('data-ck-carousel-ui', '');
    const dots: HTMLButtonElement[] = [];
    let counter: HTMLElement | null = null;
    let toggle: HTMLButtonElement | null = null;
    function inert(button: HTMLButtonElement): void {
      if (!still) return;
      button.tabIndex = -1;
      button.style.pointerEvents = 'none';
    }
    if (count > 1 && indicator === 'dots') {
      const row = page.createElement('div');
      row.setAttribute('data-ck-carousel-dots', '');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', arabic ? 'الشرائح' : 'Slides');
      slides.forEach(function dot(_slide, at) {
        const button = page.createElement('button');
        button.type = 'button';
        button.setAttribute(
          'aria-label',
          arabic
            ? `الشريحة ${digits(lang, at + 1)} من ${digits(lang, count)}`
            : `Slide ${String(at + 1)} of ${String(count)}`,
        );
        inert(button);
        if (!still) {
          button.addEventListener('click', function chosen() {
            goTo(at);
          });
        }
        dots.push(button);
        row.append(button);
      });
      ui.append(row);
    } else if (count > 1 && indicator === 'counter') {
      counter = page.createElement('span');
      counter.setAttribute('data-ck-carousel-counter', '');
      counter.setAttribute('aria-live', 'polite');
      counter.setAttribute('aria-atomic', 'true');
      ui.append(counter);
    }

    let pausedByUser = false;
    let hovering = false;
    let focused = false;
    let visible = true;
    function playing(): boolean {
      return autoplay && !pausedByUser && !hovering && !focused && visible;
    }
    function sync(): void {
      const active = current();
      dots.forEach(function mark(button, at) {
        if (at === active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      if (counter !== null) {
        counter.textContent = `${digits(lang, active + 1)} / ${digits(lang, count)}`;
        /* Autoplay ticks are not announced; a manual change is. */
        counter.setAttribute('aria-live', playing() ? 'off' : 'polite');
      }
      if (toggle !== null) {
        toggle.setAttribute(
          'aria-label',
          pausedByUser
            ? arabic
              ? 'تشغيل العرض'
              : 'Play slideshow'
            : arabic
              ? 'إيقاف العرض مؤقتًا'
              : 'Pause slideshow',
        );
        toggle.setAttribute('data-ck-paused', pausedByUser ? 'true' : 'false');
        toggle.textContent = pausedByUser ? '►' : '❚❚';
      }
    }

    if (autoplay) {
      toggle = page.createElement('button');
      toggle.type = 'button';
      toggle.setAttribute('data-ck-carousel-play', '');
      const button = toggle;
      button.addEventListener('click', function toggled() {
        pausedByUser = !pausedByUser;
        sync();
      });
      ui.append(button);
      const timer = view.setInterval(
        function tick() {
          if (!playing()) return;
          const active = current();
          goTo(active >= count - 1 ? 0 : active + 1);
        },
        el.getAttribute('data-ck-speed') === 'slow'
          ? 7000
          : el.getAttribute('data-ck-speed') === 'fast'
            ? 3500
            : 5000,
      );
      cleanups.push(function unplay() {
        view.clearInterval(timer);
      });
      listen(el, 'pointerenter', () => {
        hovering = true;
        sync();
      });
      listen(el, 'pointerleave', () => {
        hovering = false;
        sync();
      });
      listen(el, 'focusin', () => {
        focused = true;
        sync();
      });
      listen(el, 'focusout', function left(event) {
        const to = (event as FocusEvent).relatedTarget as Node | null;
        if (to !== null && el.contains(to)) return;
        focused = false;
        sync();
      });
      const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
        .IntersectionObserver;
      if (typeof Observer === 'function') {
        const observer = new Observer(function seen(entries: IntersectionObserverEntry[]) {
          for (const entry of entries) visible = entry.isIntersecting;
          sync();
        });
        observer.observe(el);
        cleanups.push(function unobserve() {
          observer.disconnect();
        });
      }
    }

    if (ui.childElementCount > 0) {
      if (track === el) el.after(ui);
      else el.append(ui);
      cleanups.push(function unbuild() {
        ui.remove();
      });
      sync();
      listen(track, 'scroll', sync, true);
    }
    if (!still) {
      listen(track, 'keydown', function navigate(event) {
        const key = event as KeyboardEvent;
        if (event.target !== track || key.altKey || key.ctrlKey || key.metaKey || key.shiftKey)
          return;
        if (key.key === 'ArrowRight' || key.key === 'ArrowLeft') {
          key.preventDefault();
          go(key.key === (rtl ? 'ArrowLeft' : 'ArrowRight'));
        } else if (key.key === 'Home' || key.key === 'End') {
          key.preventDefault();
          goTo(key.key === 'Home' ? 0 : count - 1);
        }
      });
    }

    if (!still && track !== el && count > 1) {
      const snapTrack = track as HTMLElement;
      function activate(): void {
        if (engine !== undefined || !snapTrack.isConnected) return;
        const factory = (view as Window & { ckCarouselFactory?: SnapFactory }).ckCarouselFactory;
        if (typeof factory !== 'function') return;
        try {
          engine = factory(snapTrack, {
            direction: rtl ? 'rtl' : 'ltr',
            duration: reduced ? 0 : 25,
            startIndex: current(),
          });
          engine.on('select', sync);
          engine.on('reInit', sync);
          setAttr(el, 'data-ck-carousel-engine', 'embla');
          sync();
        } catch {
          engine?.destroy();
          engine = undefined;
        }
      }
      cleanups.push(function unsnap() {
        engine?.destroy();
        engine = undefined;
      });
      listen(view, 'ck-carousel-ready', activate);
      activate();
      const locator = page.querySelector<HTMLLinkElement>('link[data-ck-engine="carousel"]');
      if (locator !== null && !page.querySelector('script[data-ck-engine="carousel"]')) {
        const script = page.createElement('script');
        script.setAttribute('data-ck-engine', 'carousel');
        script.src = locator.href;
        script.async = true;
        script.addEventListener(
          'error',
          () => {
            script.remove();
          },
          { once: true },
        );
        page.head.append(script);
      }
    }
    if (!el.hasAttribute(MARK)) setAttr(el, MARK, reduced ? 'static' : '');
  }

  const found: Element[] = [];
  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR))
    found.push(root as Element);
  found.push(...Array.from(root.querySelectorAll(SELECTOR)));
  for (const el of found) {
    if (el.hasAttribute('data-ck-clone') || el.closest('[data-ck-clone]') !== null) continue;
    mountOne(el as HTMLElement);
  }

  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = cleanups.length - 1; at >= 0; at -= 1) {
      try {
        cleanups[at]?.();
      } catch {
        // One failing cleanup must not strand the others.
      }
    }
    cleanups.length = 0;
    restoreAttrs();
  };
}
