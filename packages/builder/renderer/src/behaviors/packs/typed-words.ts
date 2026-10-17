/**
 * The `typed-words` behaviour pack (everyday site behaviours, 2026-10-13): a
 * headline word typed, held, erased and replaced by the next.
 *
 *   <h1>We build <span data-ck-behavior='typed-words'><span>websites</span><span hidden>shops</span><span hidden>brands</span></span></h1>
 *
 * The words are the host's element children, so each stays a translatable
 * text in the tree; the markup shows the first and hides the rest. Under
 * reduced motion and on the editing canvas (`interactive: false`) that is the
 * whole view: the pack only holds every word after the first `hidden` (a
 * renderer that drops the authored attribute cannot run them together).
 *
 * Animated, it hides every word, types into one `aria-hidden` span (its caret
 * is a `currentColor` inline-end border, so it follows the text colour and
 * sits after the text in either direction) and adds a visually hidden span
 * that reads the words once, comma separated: a screen reader hears the list,
 * never the letters. It starts when the host first comes into view, steps by
 * grapheme (Arabic and emoji included), and stops after two rounds on the
 * first word with the caret removed, so it never moves for long.
 * `data-ck-speed` slow|normal|fast sets the typing pace.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per element; the disposer
 * stops the timer and the observer, removes what it added and restores each
 * word's `hidden`.
 */
export function mountTypedWords(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  const cleanups: (() => void)[] = [];
  const reduced =
    win !== null &&
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc === null || win === null) {
    return function noop() {
      // Nothing was mounted.
    };
  }
  const still = options?.interactive === false || reduced;
  const page: Document = doc;
  const view: Window = win;
  const KEY = '__ckTypedWords';
  const SELECTOR = "[data-ck-behavior='typed-words']";
  const ROUNDS = 2;

  function graphemes(text: string): string[] {
    const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
    if (typeof Segmenter !== 'function') return Array.from(text);
    return Array.from(
      new Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      (part) => part.segment,
    );
  }

  function mount(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const kids = Array.from(el.children);
    const words = kids.map((kid) => kid.textContent.trim());
    if (words.length < 2 || words.includes('')) return;
    flag[KEY] = true;
    const wasHidden = kids.map((kid) => kid.hasAttribute('hidden'));
    function restore(): void {
      kids.forEach(function unhide(kid, index) {
        if (wasHidden[index] === true) kid.setAttribute('hidden', '');
        else kid.removeAttribute('hidden');
      });
      flag[KEY] = false;
    }
    kids.forEach(function hide(kid, index) {
      if (!still || index > 0) kid.setAttribute('hidden', '');
    });
    if (still) {
      cleanups.push(restore);
      return;
    }
    const typed = page.createElement('span');
    typed.setAttribute('aria-hidden', 'true');
    typed.style.borderInlineEnd = '0.08em solid currentColor';
    typed.style.paddingInlineEnd = '0.04em';
    const spoken = page.createElement('span');
    spoken.textContent = words.join(', ');
    Object.assign(spoken.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    });
    el.append(typed, spoken);

    const speed = el.getAttribute('data-ck-speed');
    const step = speed === 'slow' ? 120 : speed === 'fast' ? 45 : 75;
    let word = 0;
    let letters = graphemes(words[0] ?? '');
    let at = letters.length;
    let erasing = true;
    let rounds = 0;
    let timer = 0;
    /* A zero-width space keeps the caret's line. */
    function show(): void {
      typed.textContent = at === 0 ? '\u200b' : letters.slice(0, at).join('');
    }
    function tick(): void {
      if (erasing) {
        at -= 1;
        show();
        if (at > 0) {
          timer = view.setTimeout(tick, step / 2);
          return;
        }
        erasing = false;
        word = (word + 1) % words.length;
        if (word === 0) rounds += 1;
        letters = graphemes(words[word] ?? '');
        timer = view.setTimeout(tick, 300);
        return;
      }
      at += 1;
      show();
      if (at < letters.length) {
        timer = view.setTimeout(tick, step);
        return;
      }
      if (word === 0 && rounds >= ROUNDS) {
        typed.style.borderInlineEnd = '';
        return;
      }
      erasing = true;
      timer = view.setTimeout(tick, 1600);
    }
    function start(): void {
      timer = view.setTimeout(tick, 1600);
    }
    show();

    const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    let observer: IntersectionObserver | undefined;
    if (typeof Observer === 'function') {
      observer = new Observer(function seen(entries: IntersectionObserverEntry[]) {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        start();
      });
      observer.observe(el);
    } else start();

    cleanups.push(function unmount() {
      view.clearTimeout(timer);
      observer?.disconnect();
      typed.remove();
      spoken.remove();
      restore();
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
