/**
 * The `read-more` behaviour pack (everyday site behaviours, 2026-10-13): a
 * long text shown as its first lines, with a button that opens the rest.
 *
 *   <div data-ck-behavior='read-more' data-ck-text='Show less'>
 *     <div>…the long text…</div>
 *     <button type='button' hidden>Read more</button>
 *   </div>
 *
 * The first element child is the text, the last button child the control.
 * The markup ships the button `hidden`, so without the script the whole text
 * reads and no dead button shows. Mounted, the pack measures the text: when
 * it runs past the clamp (4 lines, or the `--ck-lines` the region css sets on
 * the text) it caps the text's height with a fading mask and reveals the
 * button — `aria-expanded`, `aria-controls` — which toggles the clamp and,
 * when `data-ck-text` is written, swaps its label. A text that fits keeps the
 * button hidden. The clamp never hides the words from a screen reader, which
 * reads all of them either way. Nothing animates, so reduced motion has
 * nothing to stop; the mask is alpha only, no colour.
 *
 * On the editing canvas (`interactive: false`) the button is shown, so it can
 * be edited, and the text stays whole.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per element; the disposer
 * removes the listener and restores every attribute, style and label it set.
 */
export function mountReadMore(
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
  const view: Window = win;
  const interactive = options?.interactive !== false;
  const KEY = '__ckReadMore';
  const SELECTOR = "[data-ck-behavior='read-more']";

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

  function mount(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const body = el.firstElementChild as HTMLElement | null;
    const buttons = Array.from(el.children).filter((child) => child.tagName === 'BUTTON');
    const last = buttons[buttons.length - 1] as HTMLButtonElement | undefined;
    if (body === null || last === undefined || body === last) return;
    const button: HTMLButtonElement = last;
    flag[KEY] = true;
    cleanups.push(function unflag() {
      flag[KEY] = false;
    });
    if (!interactive) {
      setAttr(button, 'hidden', null);
      return;
    }
    const computed = view.getComputedStyle(body);
    const lines = Math.min(
      20,
      Math.max(1, parseInt(computed.getPropertyValue('--ck-lines'), 10) || 4),
    );
    const line = parseFloat(computed.lineHeight) || (parseFloat(computed.fontSize) || 16) * 1.5;
    const limit = Math.round(lines * line);
    if (body.scrollHeight <= limit + line / 2) {
      setAttr(button, 'hidden', '');
      return;
    }
    if (body.id === '') setAttr(body, 'id', `ck-more-${Math.random().toString(36).slice(2, 9)}`);
    setAttr(button, 'aria-controls', body.id);
    setAttr(button, 'hidden', null);
    const label = Array.from(button.childNodes).find(
      (node) => node.nodeType === 3 && /\S/u.test(node.nodeValue ?? ''),
    );
    const more = label === undefined ? '' : (label.nodeValue ?? '');
    const less = el.getAttribute('data-ck-text') ?? '';
    const style = body.style;
    const before = [style.maxHeight, style.overflow, style.getPropertyValue('mask-image')];
    let open = false;
    function render(): void {
      setAttr(button, 'aria-expanded', open ? 'true' : 'false');
      style.maxHeight = open ? (before[0] ?? '') : `${String(limit)}px`;
      style.overflow = open ? (before[1] ?? '') : 'hidden';
      style.setProperty(
        'mask-image',
        open ? (before[2] ?? '') : 'linear-gradient(#000 55%, transparent)',
      );
      if (label !== undefined && less !== '') label.nodeValue = open ? less : more;
    }
    function toggle(): void {
      open = !open;
      render();
      /* Bring a closed text's start back into view. */
      if (!open && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'nearest' });
    }
    render();
    button.addEventListener('click', toggle);
    cleanups.push(function unclamp() {
      button.removeEventListener('click', toggle);
      style.maxHeight = before[0] ?? '';
      style.overflow = before[1] ?? '';
      style.setProperty('mask-image', before[2] ?? '');
      if (label !== undefined) label.nodeValue = more;
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
    for (let at = saved.length - 1; at >= 0; at -= 1) {
      const item = saved[at];
      if (item === undefined || item.el.getAttribute(item.name) !== item.applied) continue;
      if (item.original === null) item.el.removeAttribute(item.name);
      else item.el.setAttribute(item.name, item.original);
    }
    saved.length = 0;
  };
}
