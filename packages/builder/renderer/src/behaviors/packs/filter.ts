/**
 * The `filter` behaviour pack (everyday site behaviours, 2026-10-13): buttons
 * that narrow a grid to one group — a portfolio's "All / Branding / Web".
 *
 *   <div data-ck-behavior='filter'>
 *     <button type='button' data-ck-filter='all'>All</button>
 *     <button type='button' data-ck-filter='web'>Web</button>
 *     <article data-ck-filter='web print'>…</article>
 *   </div>
 *
 * Inside the host, a `button` with `data-ck-filter` names one group (`all`
 * shows everything); any other element with `data-ck-filter` lists the groups
 * it belongs to, space separated. A press marks that button `aria-pressed`
 * true (the others false) and sets `hidden` on every item outside its group.
 * The first state is the button already marked `aria-pressed='true'`, else
 * the first. Native buttons, so keyboard and screen readers need nothing
 * more; nothing animates; the buttons follow reading order in RTL.
 *
 * Without the script, and on the editing canvas (`interactive: false`), every
 * item shows — the pack does nothing there.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per host; the disposer
 * removes the listener and restores every attribute it set unless the host
 * (React) has rewritten it since.
 */
export function mountFilter(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const cleanups: (() => void)[] = [];
  if (doc === null || options?.interactive === false) {
    return function noop() {
      // Every item shows: nothing was mounted.
    };
  }
  const KEY = '__ckFilter';
  const SELECTOR = "[data-ck-behavior='filter']";

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

  function mount(el: Element): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const parts = Array.from(el.querySelectorAll('[data-ck-filter]')).filter(
      (part) => part.closest(SELECTOR) === el,
    );
    const buttons = parts.filter((part) => part.tagName === 'BUTTON');
    const items = parts.filter((part) => part.tagName !== 'BUTTON');
    if (buttons.length === 0 || items.length === 0) return;
    flag[KEY] = true;
    function pick(chosen: Element): void {
      const group = (chosen.getAttribute('data-ck-filter') ?? '').trim();
      for (const button of buttons)
        setAttr(button, 'aria-pressed', button === chosen ? 'true' : 'false');
      for (const item of items) {
        const groups = (item.getAttribute('data-ck-filter') ?? '').split(/\s+/u);
        setAttr(item, 'hidden', group === 'all' || groups.includes(group) ? null : '');
      }
    }
    function press(event: Event): void {
      const target = event.target as Element | null;
      const button = target === null ? null : target.closest('button');
      if (button !== null && buttons.includes(button)) pick(button);
    }
    const first =
      buttons.find((button) => button.getAttribute('aria-pressed') === 'true') ?? buttons[0];
    if (first !== undefined) pick(first);
    el.addEventListener('click', press);
    cleanups.push(function unmount() {
      el.removeEventListener('click', press);
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
  };
}
