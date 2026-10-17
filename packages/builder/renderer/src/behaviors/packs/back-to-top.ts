/**
 * The `back-to-top` behaviour pack (everyday site behaviours, 2026-10-13).
 *
 *   <a href='#top' data-ck-behavior='back-to-top' aria-label='Back to top' class='fixed bottom-6 end-6'>
 *
 * Progressive enhancement over a link that already works: `#top` scrolls a
 * page to its start with no script at all. The pack keeps the control out of
 * sight (`visibility: hidden`, so it leaves the tab order and the
 * accessibility tree too) until the visitor has scrolled one screen down, and
 * a press scrolls smoothly — instantly under reduced motion — and moves
 * keyboard focus to the top (the `href` target, else the first `h1`, else the
 * body), so the next Tab starts where the eye now is. Where it stands is the
 * author's classes: `end-6` sits at the inline end, so it mirrors in RTL.
 *
 * On the editing canvas (`interactive: false`) nothing is hidden or wired.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per element; the disposer
 * removes the listeners and restores the inline styles it wrote.
 */
export function mountBackToTop(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  const cleanups: (() => void)[] = [];
  if (doc === null || win === null || options?.interactive === false) {
    return function noop() {
      // The canvas shows the control where it stands: nothing was mounted.
    };
  }
  const page: Document = doc;
  const view: Window = win;
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = '__ckBackToTop';
  const SELECTOR = "[data-ck-behavior='back-to-top']";

  function mount(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    flag[KEY] = true;
    const style = el.style;
    const saved = [style.visibility, style.opacity, style.transition];
    let shown: boolean | undefined;
    function check(): void {
      const next = view.scrollY > view.innerHeight;
      if (next === shown) return;
      /* Fade only after the first state: no fade on load. */
      if (shown !== undefined && !reduced) style.transition = 'opacity .2s, visibility .2s';
      shown = next;
      style.visibility = next ? (saved[0] ?? '') : 'hidden';
      style.opacity = next ? (saved[1] ?? '') : '0';
    }
    function up(event: Event): void {
      event.preventDefault();
      view.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      const href = el.getAttribute('href') ?? '';
      const target = ((href.length > 1 ? page.getElementById(href.slice(1)) : null) ??
        page.querySelector('h1') ??
        page.body) as HTMLElement | null;
      if (target === null) return;
      if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener(
          'blur',
          function untab() {
            target.removeAttribute('tabindex');
          },
          { once: true },
        );
      }
      target.focus({ preventScroll: true });
    }
    check();
    view.addEventListener('scroll', check, { passive: true });
    el.addEventListener('click', up);
    cleanups.push(function unmount() {
      view.removeEventListener('scroll', check);
      el.removeEventListener('click', up);
      style.visibility = saved[0] ?? '';
      style.opacity = saved[1] ?? '';
      style.transition = saved[2] ?? '';
      flag[KEY] = false;
    });
  }

  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR))
    mount(root as HTMLElement);
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) mount(el as HTMLElement);

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
  };
}
