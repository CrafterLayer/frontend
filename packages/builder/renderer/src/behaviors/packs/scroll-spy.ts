/**
 * The `scroll-spy` behaviour pack (everyday site behaviours, 2026-10-13): a
 * one-page nav that knows where the reader is, and in-page links that land
 * below a sticky header.
 *
 *   <nav data-ck-behavior='scroll-spy' aria-label='Sections'>
 *     <a href='#services'>Services</a> <a href='#prices'>Prices</a>
 *   </nav>
 *
 * Every `a href='#id'` inside the host whose target exists is tracked. While
 * the page scrolls, the link of the last section whose top has passed a line
 * 30% down the screen (below the header) carries `aria-current='true'` — the
 * region css styles it with `[aria-current]` — and at the very bottom the last
 * link does. The header is the nearest sticky or fixed ancestor of the nav (an
 * open popover sheet is skipped); its height becomes the page's
 * `scroll-padding-top`, so the browser's own anchor jump, a focused field and
 * a deep link all land below it rather than under it. A press on a tracked
 * link turns on smooth scrolling unless the reader prefers reduced motion or
 * Lenis already runs, and closes the popover sheet it sits in (the phone
 * menu). The link itself is left to the browser, so the address, history and
 * focus move as they always do. Nothing here depends on direction.
 *
 * On the editing canvas (`interactive: false`) it does nothing.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per host; the disposer removes
 * the listeners, cancels a pending frame, and restores the attributes and the
 * page styles it set unless something else has rewritten them since.
 */
export function mountScrollSpy(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  const cleanups: (() => void)[] = [];
  if (doc === null || win === null || options?.interactive === false) {
    return function noop() {
      // Nothing was mounted.
    };
  }
  const page: Document = doc;
  const view: Window = win;
  const html = page.documentElement;
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = '__ckScrollSpy';
  const SELECTOR = "[data-ck-behavior='scroll-spy']";

  const saved: { el: Element; name: string; original: string | null; applied: string | null }[] =
    [];
  function setAttr(el: Element, name: string, value: string | null): void {
    let entry = saved.find((item) => item.el === el && item.name === name);
    if (entry === undefined) {
      entry = { el, name, original: el.getAttribute(name), applied: null };
      saved.push(entry);
    }
    entry.applied = value;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
  const pageStyle = html.style;
  const pageBefore = [pageStyle.scrollPaddingTop, pageStyle.scrollBehavior];
  const pageApplied = ['', ''];

  function headerHeight(el: Element): number {
    for (
      let node: Element | null = el;
      node !== null && node !== page.body;
      node = node.parentElement
    ) {
      if (node.hasAttribute('popover')) continue;
      const position = view.getComputedStyle(node).position;
      if (position === 'sticky' || position === 'fixed') return node.getBoundingClientRect().height;
    }
    return 0;
  }

  function mount(el: Element): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const links: [Element, Element][] = [];
    for (const link of Array.from(el.querySelectorAll("a[href^='#']"))) {
      let id = '';
      try {
        id = decodeURIComponent((link.getAttribute('href') ?? '').slice(1));
      } catch {
        id = '';
      }
      const target = id === '' ? null : page.getElementById(id);
      if (target !== null) links.push([link, target]);
    }
    if (links.length === 0) return;
    flag[KEY] = true;
    let frame = 0;
    function pad(offset: number): void {
      if (offset <= 0) return;
      const value = `${String(Math.round(offset) + 8)}px`;
      if (pageStyle.scrollPaddingTop === value) return;
      pageStyle.scrollPaddingTop = value;
      pageApplied[0] = value;
    }
    function update(): void {
      frame = 0;
      const offset = headerHeight(el);
      pad(offset);
      const line = offset + view.innerHeight * 0.3;
      let current: Element | null = null;
      for (const [link, target] of links)
        if (target.getBoundingClientRect().top <= line) current = link;
      /* At the end of a page that scrolls, the last section. */
      const last = links[links.length - 1];
      const end = html.scrollHeight;
      if (
        current !== null &&
        last !== undefined &&
        end > view.innerHeight &&
        view.innerHeight + view.scrollY >= end - 2
      )
        current = last[0];
      for (const [link] of links) {
        const value = link === current ? 'true' : null;
        if (link.getAttribute('aria-current') !== value) setAttr(link, 'aria-current', value);
      }
    }
    function schedule(): void {
      if (frame === 0) frame = view.requestAnimationFrame(update);
    }
    function follow(event: Event): void {
      const target = event.target as Element | null;
      const link = target === null ? null : target.closest('a');
      if (link === null || !links.some((pair) => pair[0] === link)) return;
      pad(headerHeight(el));
      if (!reduced && !html.classList.contains('lenis')) {
        pageStyle.scrollBehavior = 'smooth';
        pageApplied[1] = 'smooth';
      }
      const sheet = link.closest<HTMLElement>('[popover]');
      if (sheet !== null && 'hidePopover' in sheet) {
        try {
          sheet.hidePopover();
        } catch {
          // Already closed.
        }
      }
    }
    update();
    view.addEventListener('scroll', schedule, { passive: true });
    view.addEventListener('resize', schedule);
    el.addEventListener('click', follow);
    cleanups.push(function unmount() {
      view.removeEventListener('scroll', schedule);
      view.removeEventListener('resize', schedule);
      el.removeEventListener('click', follow);
      if (frame !== 0) view.cancelAnimationFrame(frame);
      flag[KEY] = false;
    });
  }

  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) mount(root as Element);
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) mount(el);

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
    for (let at = saved.length - 1; at >= 0; at -= 1) {
      const item = saved[at];
      if (item === undefined || item.el.getAttribute(item.name) !== item.applied) continue;
      if (item.original === null) item.el.removeAttribute(item.name);
      else item.el.setAttribute(item.name, item.original);
    }
    saved.length = 0;
    if (pageApplied[0] !== '' && pageStyle.scrollPaddingTop === pageApplied[0])
      pageStyle.scrollPaddingTop = pageBefore[0] ?? '';
    if (pageApplied[1] !== '' && pageStyle.scrollBehavior === pageApplied[1])
      pageStyle.scrollBehavior = pageBefore[1] ?? '';
  };
}
