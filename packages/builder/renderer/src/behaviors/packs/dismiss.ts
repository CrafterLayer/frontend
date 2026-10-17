/**
 * The `dismiss` behaviour pack (everyday site behaviours, 2026-10-13): a
 * notice the visitor can close, and that stays closed on their next visit.
 *
 *   <div data-ck-behavior='dismiss' role='region' aria-label='Announcement'>
 *     <p>Free delivery this week</p>
 *     <button type='button' aria-label='Close' hidden><icon name='x'/></button>
 *   </div>
 *
 * The control is the host's last `button`. The markup ships it `hidden`, so
 * without the script the notice simply reads and no dead button shows.
 * Mounted, the pack reveals the button; a press sets `hidden` on the host and
 * remembers it in this browser's `localStorage`, under a key made from the
 * notice's own text — so a changed notice shows again. Private windows that
 * refuse storage close it for this visit only. When focus was inside the
 * notice it moves to `main` (or the body) instead of being lost.
 *
 * On the editing canvas (`interactive: false`) the button is shown, so it can
 * be edited, and the notice never hides.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per host; the disposer
 * removes the listener and restores every attribute it set unless the host
 * (React) has rewritten it since.
 */
export function mountDismiss(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  const cleanups: (() => void)[] = [];
  if (doc === null || win === null) {
    return function noop() {
      // Nothing was mounted.
    };
  }
  const page: Document = doc;
  const view: Window = win;
  const interactive = options?.interactive !== false;
  const KEY = '__ckDismiss';
  const SELECTOR = "[data-ck-behavior='dismiss']";

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

  function storageKey(el: Element): string {
    let hash = 5381;
    for (const char of el.textContent.trim()) hash = (hash * 33 + (char.codePointAt(0) ?? 0)) | 0;
    return `ck-dismiss:${(hash >>> 0).toString(36)}`;
  }

  function mount(el: Element): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const buttons = el.querySelectorAll('button');
    const close = buttons[buttons.length - 1];
    if (close === undefined) return;
    flag[KEY] = true;
    cleanups.push(function unflag() {
      flag[KEY] = false;
    });
    if (!interactive) {
      setAttr(close, 'hidden', null);
      return;
    }
    const key = storageKey(el);
    let closed = false;
    try {
      closed = view.localStorage.getItem(key) === '1';
    } catch {
      closed = false;
    }
    if (closed) {
      setAttr(el, 'hidden', '');
      return;
    }
    setAttr(close, 'hidden', null);
    function shut(): void {
      const focused = el.contains(page.activeElement);
      setAttr(el, 'hidden', '');
      try {
        view.localStorage.setItem(key, '1');
      } catch {
        // Storage refused (a private window): closed for this visit only.
      }
      if (!focused) return;
      const next = page.querySelector('main') ?? page.body;
      if (!next.hasAttribute('tabindex')) {
        next.setAttribute('tabindex', '-1');
        next.addEventListener(
          'blur',
          function untab() {
            next.removeAttribute('tabindex');
          },
          { once: true },
        );
      }
      next.focus({ preventScroll: true });
    }
    close.addEventListener('click', shut);
    cleanups.push(function unmount() {
      close.removeEventListener('click', shut);
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
  };
}
