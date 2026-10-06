/**
 * The `toggle-group` behaviour pack (media-motion DESIGN §E): a two-state
 * switch over a container whose descendants carry `data-ck-option="a"` or
 * `"b"` — monthly and yearly prices, typically.
 *
 * The markup ships the `b` options with `hidden`, so without the script the
 * `a` state reads on its own. The pack adopts the first `button` inside the
 * container that is not itself inside an option as the switch (or prepends one
 * when there is none): `role="switch"`, `aria-checked`, and the label
 * «شهري / سنوي» or "Monthly / Yearly" when the button has no text of its own.
 * Pressing it flips `hidden` between the `a` and `b` options. The knob and
 * track are `WIDGETS_PACK_CSS` (`[data-ck-switch]`), in logical properties, so
 * the knob travels from the inline start in either direction.
 *
 * On the editing canvas (`interactive: false`) it shows `a` and is inert.
 *
 * Self-contained for `Function.prototype.toString` serialisation: no imports,
 * no module-scope reads. Idempotent per container; the disposer removes the
 * listener and an inserted switch, and restores every attribute it set —
 * `hidden` included — unless the host has since rewritten it.
 */
export function mountToggleGroup(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const cleanups: (() => void)[] = [];
  if (doc === null) return function noop() {
      // Nothing was mounted.
    };
  const page: Document = doc;
  const interactive = options?.interactive !== false;
  const MARK = 'data-ck-mounted';
  const KEY = '__ckToggleGroup';
  const SELECTOR = "[data-ck-behavior='toggle-group']";

  const saved: { el: Element; name: string; original: string | null; applied: string | null }[] = [];
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

  function isArabic(el: Element): boolean {
    const owner = el.closest('[lang]');
    const lang = owner === null ? page.documentElement.lang : (owner.getAttribute('lang') ?? '');
    return /^ar(?:-|$)/iu.test(lang);
  }

  function mount(el: Element): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const owned = Array.from(el.querySelectorAll('[data-ck-option]')).filter(
      (option) => option.parentElement?.closest(SELECTOR) === el,
    );
    const first = owned.filter((option) => option.getAttribute('data-ck-option') === 'a');
    const second = owned.filter((option) => option.getAttribute('data-ck-option') === 'b');
    if (first.length === 0 || second.length === 0) return;
    flag[KEY] = true;
    let button = Array.from(el.querySelectorAll('button')).find(
      (candidate) => candidate.closest('[data-ck-option]') === null && candidate.closest(SELECTOR) === el,
    );
    let inserted = false;
    const label = isArabic(el) ? 'شهري / سنوي' : 'Monthly / Yearly';
    if (button === undefined) {
      button = page.createElement('button');
      button.type = 'button';
      button.textContent = label;
      el.insertBefore(button, el.firstChild);
      inserted = true;
    } else if (button.textContent.trim() === '' && button.getAttribute('aria-label') === null) {
      setAttr(button, 'aria-label', label);
    }
    const toggle: HTMLButtonElement = button;
    setAttr(toggle, 'role', 'switch');
    setAttr(toggle, 'data-ck-switch', '');
    if (!interactive) {
      toggle.style.pointerEvents = 'none';
      if (inserted) toggle.tabIndex = -1;
    }
    function show(on: boolean): void {
      setAttr(toggle, 'aria-checked', on ? 'true' : 'false');
      for (const option of first) setAttr(option, 'hidden', on ? '' : null);
      for (const option of second) setAttr(option, 'hidden', on ? null : '');
    }
    show(false);
    function flip(): void {
      show(toggle.getAttribute('aria-checked') !== 'true');
    }
    if (interactive) toggle.addEventListener('click', flip);
    setAttr(el, MARK, el.getAttribute(MARK) ?? '');
    cleanups.push(function unmount() {
      toggle.removeEventListener('click', flip);
      if (inserted) toggle.remove();
      else if (!interactive) toggle.style.removeProperty('pointer-events');
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
