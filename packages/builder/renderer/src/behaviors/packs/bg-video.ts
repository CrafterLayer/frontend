/**
 * The `bg-video` behaviour pack (media-motion DESIGN §A.1, §A.2): a section
 * `[data-ck-behavior="bg-video"]` whose first child is a muted, looping,
 * inline `<video>` laid behind the content.
 *
 * - The tree carries no `autoplay` (an authored one is dropped while mounted):
 *   this pack calls `play()` only when the page is interactive, motion is
 *   allowed, the section is in view and the tab is visible, and pauses it
 *   otherwise. Without the script the poster shows.
 * - It adds a pause/play toggle at the inline end, block end of the section
 *   («إيقاف الخلفية» / «تشغيل الخلفية», "Pause background" / "Play
 *   background"), so moving content can be stopped (WCAG 2.2.2).
 * - Under reduced motion and on the editing canvas nothing plays and no
 *   button is drawn.
 *
 * Self-contained and serialised like every pack: no imports, no module scope.
 */
export function mountBgVideo(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null)
    return function noop() {
      // ignore
    };
  const view: Window = win;
  const page: Document = doc;
  const interactive = options?.interactive !== false;
  const MARK = 'data-ck-bg-video';
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups: (() => void)[] = [];

  const saved: {
    el: Element;
    name: string;
    original: string | null;
    applied: string | null;
    order: string[];
  }[] = [];
  function setAttr(el: Element, name: string, value: string | null): void {
    let entry = null as (typeof saved)[number] | null;
    for (const item of saved) if (item.el === el && item.name === name) entry = item;
    if (entry === null) {
      entry = { el, name, original: el.getAttribute(name), applied: null, order: el.getAttributeNames() };
      saved.push(entry);
    }
    entry.applied = value;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }

  function listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    cleanups.push(function unlisten() {
      target.removeEventListener(type, handler);
    });
  }

  function halt(video: HTMLVideoElement): void {
    try {
      video.pause();
    } catch {
      // ignore
    }
  }

  function background(el: HTMLElement, video: HTMLVideoElement): void {
    setAttr(el, MARK, reduced ? 'static' : interactive ? '' : 'still');
    if (video.hasAttribute('autoplay')) setAttr(video, 'autoplay', null);
    if (!interactive || reduced) {
      halt(video);
      return;
    }
    const owner = el.closest('[lang]');
    const lang = owner === null ? page.documentElement.lang : (owner.getAttribute('lang') ?? '');
    const ar = /^ar/iu.test(lang);
    video.muted = true;
    let held = false;
    let seen = false;
    let started = false;
    const toggle = page.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ck-bgv-toggle';
    function sync(): void {
      const go = seen && !held && page.visibilityState !== 'hidden';
      toggle.setAttribute(
        'aria-label',
        held ? (ar ? 'تشغيل الخلفية' : 'Play background') : ar ? 'إيقاف الخلفية' : 'Pause background',
      );
      toggle.classList.toggle('ck-paused', held);
      if (!go) {
        halt(video);
        return;
      }
      started = true;
      try {
        const pending = video.play() as Promise<void> | undefined;
        if (pending !== undefined) {
          pending.catch(function refused() {
            // ignore
          });
        }
      } catch {
        // ignore
      }
    }
    listen(toggle, 'click', function flip() {
      held = !held;
      sync();
    });
    listen(page, 'visibilitychange', sync);
    const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    if (typeof Observer === 'function') {
      const observer = new Observer(
        function seenNow(entries: IntersectionObserverEntry[]) {
          for (const entry of entries) seen = entry.isIntersecting;
          sync();
        },
        { threshold: 0 },
      );
      observer.observe(el);
      cleanups.push(function unobserve() {
        observer.disconnect();
      });
    } else {
      seen = true;
    }
    el.appendChild(toggle);
    cleanups.push(function unmount() {
      toggle.remove();
      if (started) halt(video);
    });
    sync();
  }

  const SELECTOR = '[data-ck-behavior="bg-video"]';
  const found: Element[] = [];
  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) found.push(root as Element);
  found.push(...Array.from(root.querySelectorAll(SELECTOR)));
  for (const el of found) {
    if (el.hasAttribute(MARK)) continue;
    const first = el.firstElementChild;
    const video = first !== null && first.tagName === 'VIDEO' ? first : el.querySelector('video');
    if (video !== null) background(el as HTMLElement, video as HTMLVideoElement);
  }

  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = cleanups.length - 1; at >= 0; at -= 1) {
      try {
        cleanups[at]?.();
      } catch {
        // ignore
      }
    }
    cleanups.length = 0;
    for (let at = saved.length - 1; at >= 0; at -= 1) {
      const item = saved[at];
      if (item === undefined || item.el.getAttribute(item.name) !== item.applied) continue;
      const missing = !item.el.hasAttribute(item.name);
      if (item.original === null) item.el.removeAttribute(item.name);
      else item.el.setAttribute(item.name, item.original);
      if (!missing || item.original === null) continue;
      for (const name of item.order.slice(item.order.indexOf(item.name) + 1)) {
        const value = item.el.getAttribute(name);
        if (value === null) continue;
        item.el.removeAttribute(name);
        item.el.setAttribute(name, value);
      }
    }
    saved.length = 0;
  };
}
