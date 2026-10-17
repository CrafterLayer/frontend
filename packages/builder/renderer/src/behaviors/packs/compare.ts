/**
 * The `compare` behaviour pack (media-motion DESIGN §E): a before/after
 * slider over a container with exactly two `img` children — the first is
 * "before", the second "after".
 *
 * It appends a native `input[type=range]` (0–100, value 50) labelled
 * «قبل / بعد» or "Before / after" — or the container's `data-ck-compare-label`
 * and `data-ck-compare-start` (0–100) when it carries them, as the
 * Before/After block does — whose `aria-valuetext` reads the position
 * as a percentage in the page's digits, and writes the position to the
 * container as `--ck-compare` (`50%`). `WIDGETS_PACK_CSS` clips the after
 * image with `clip-path: inset()` from the INLINE START — the left under LTR,
 * the right under RTL — so the divider sits where the native range's thumb
 * sits in either direction. The keyboard is the native range's.
 *
 * On the editing canvas (`interactive: false`) the slider is drawn at 50% and
 * inert: not a tab stop and not a pointer target, so a click selects. Reduced
 * motion changes nothing: the slider moves only when a person moves it.
 *
 * Serialised with `Function.prototype.toString` into the published runtime,
 * so it has NO imports and reads NO module-scope identifier; every helper is
 * declared inside. Idempotent per element (an expando, so a mount marker the
 * core runtime wrote for a motion preset on the same element never blocks
 * it), and the disposer removes the control and restores every attribute and
 * the custom property it set.
 */
export function mountCompare(
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
  const KEY = '__ckCompare';
  const PROP = '--ck-compare';
  const SELECTOR = "[data-ck-behavior='compare']";

  function langOf(el: Element): string {
    const owner = el.closest('[lang]');
    const lang = owner === null ? '' : (owner.getAttribute('lang') ?? '');
    const chosen = lang !== '' ? lang : page.documentElement.lang;
    if (/^ar(?:-|$)/iu.test(chosen) && !/-u-/iu.test(chosen) && !/^ar-(?:MA|DZ|TN|LY|EH)\b/iu.test(chosen)) {
      return `${chosen}-u-nu-arab`;
    }
    return chosen;
  }

  function percent(lang: string, value: number): string {
    try {
      return new Intl.NumberFormat(lang === '' ? undefined : lang, { style: 'percent' }).format(value / 100);
    } catch {
      return `${String(value)}%`;
    }
  }

  function mount(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const images = Array.from(el.children).filter((child) => child.tagName === 'IMG');
    if (images.length !== 2) return;
    flag[KEY] = true;
    const lang = langOf(el);
    const arabic = lang.toLowerCase().startsWith('ar');
    const hadMark = el.getAttribute(MARK);
    const hadValue = el.style.getPropertyValue(PROP);
    const range = page.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '1';
    // blocks (2026-10-13): a Before/After block names its slider and its start position.
    const start = Number(el.getAttribute('data-ck-compare-start'));
    const fromBlock = el.hasAttribute('data-ck-compare-start') && start >= 0 && start <= 100;
    range.value = fromBlock ? String(start) : '50';
    range.setAttribute('data-ck-compare-range', '');
    const named = el.getAttribute('data-ck-compare-label');
    range.setAttribute('aria-label', named ?? (arabic ? 'قبل / بعد' : 'Before / after'));
    if (!interactive) {
      range.tabIndex = -1;
      range.style.pointerEvents = 'none';
    }
    function write(): void {
      const value = Math.min(100, Math.max(0, Number(range.value) || 0));
      el.style.setProperty(PROP, `${String(value)}%`);
      range.setAttribute('aria-valuetext', percent(lang, value));
    }
    write();
    el.appendChild(range);
    if (hadMark === null) el.setAttribute(MARK, '');
    if (interactive) range.addEventListener('input', write);
    cleanups.push(function unmount() {
      range.removeEventListener('input', write);
      range.remove();
      if (hadValue === '') el.style.removeProperty(PROP);
      else el.style.setProperty(PROP, hadValue);
      if (hadMark === null && el.getAttribute(MARK) === '') el.removeAttribute(MARK);
      flag[KEY] = false;
    });
  }

  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) mount(root as HTMLElement);
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
