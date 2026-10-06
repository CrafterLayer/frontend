/**
 * The `gallery` and `lightbox` behaviours (media-motion DESIGN §B.2, D2): one
 * shared `<dialog data-ck-lightbox>` per gallery that walks every image in it.
 *
 * - `lightbox` is the single-image case, preserved from `runtime.ts`: the
 *   element itself (a figure, an img, a button or a link) opens the dialog of
 *   its first image, with the same markup — the image and a close button
 *   labelled «إغلاق» / Close — and focus returns to the element on close.
 * - `gallery` is a container: every descendant `img` that is not inside a
 *   `[data-ck-clone]` (a marquee copy) or a nested gallery is a thumbnail. Each
 *   thumbnail becomes a button (`tabindex=0`, `role=button`,
 *   `aria-haspopup=dialog`, unless it already sits in a link or button), and
 *   click, Enter or Space opens the dialog at that image.
 *
 * The group dialog adds a caption (the nearest figure's figcaption, else the
 * alt text), a counter in a polite live region («٣ / ١٢» under `lang=ar`, in
 * Arabic-Indic digits), and previous/next buttons («السابق» / «التالي»).
 * ←/→ step through the images and are swapped under RTL, Home/End jump to the
 * ends, Esc closes (the native dialog). A touch swipe of 40 px or more steps
 * too, its sign mirrored under RTL. The next and previous images are
 * preloaded. Transitions live in CSS under `prefers-reduced-motion:
 * no-preference` only (`GALLERY_PACK_CSS`).
 *
 * On the editing canvas (`interactive: false`) nothing is attached: a click
 * there selects the element.
 *
 * Self-contained and serialisable like `mountBehaviors`: no imports, no
 * module-scope reads. Idempotent per element; the disposer removes the dialog
 * and every listener and restores each attribute the host has not rewritten.
 */
export function mountGallery(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null || options?.interactive === false) {
    return function noop() {
      // Nothing was mounted (no document, or the editing canvas), so nothing to undo.
    };
  }
  const view: Window = win;
  const page: Document = doc;
  const MARK = 'data-ck-mounted';
  const KEY = '__ckGallery';
  const SELECTOR = "[data-ck-behavior='gallery'], [data-ck-behavior='lightbox']";
  const SWIPE = 40;
  const cleanups: (() => void)[] = [];

  /* ── attribute bookkeeping: restore only what the host has not rewritten ── */
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

  function listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    cleanups.push(function unlisten() {
      target.removeEventListener(type, handler);
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

  /* The page language; Arabic counts in Arabic-Indic digits unless the region writes Latin ones. */
  function langOf(el: Element): string {
    const owner = el.closest('[lang]');
    const lang = owner === null ? '' : (owner.getAttribute('lang') ?? '');
    const chosen = lang !== '' ? lang : page.documentElement.lang;
    if (/^ar(?:-|$)/iu.test(chosen) && !/-u-/iu.test(chosen) && !/^ar-(?:MA|DZ|TN|LY|EH)\b/iu.test(chosen)) {
      return `${chosen}-u-nu-arab`;
    }
    return chosen;
  }

  function digits(lang: string, value: number): string {
    try {
      return new Intl.NumberFormat(lang === '' ? undefined : lang, { useGrouping: false }).format(value);
    } catch {
      return String(value);
    }
  }

  function srcOf(image: HTMLImageElement): string {
    return image.currentSrc !== '' ? image.currentSrc : image.src;
  }

  function mountOne(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const single = el.getAttribute('data-ck-behavior') === 'lightbox';

    /* The thumbnails, each with the element that opens it. */
    const items: { image: HTMLImageElement; trigger: HTMLElement }[] = [];
    if (single) {
      const image = el.tagName === 'IMG' ? (el as HTMLImageElement) : el.querySelector('img');
      if (image !== null) items.push({ image, trigger: el });
    } else {
      for (const image of Array.from(el.querySelectorAll('img'))) {
        if (image.closest('[data-ck-clone]') !== null) continue;
        if (image.closest(SELECTOR) !== el) continue;
        const wrap = image.closest('a, button');
        const trigger = wrap !== null && wrap !== el && el.contains(wrap) ? (wrap as HTMLElement) : image;
        if (items.some((item) => item.trigger === trigger)) continue;
        items.push({ image, trigger });
      }
    }
    if (items.length === 0) return;
    flag[KEY] = true;
    cleanups.push(function unflag() {
      Reflect.deleteProperty(flag, KEY);
    });

    const lang = langOf(el);
    const arabic = lang.toLowerCase().startsWith('ar');
    const rtl = isRtl(el);
    const count = items.length;
    const group = count > 1;

    let open: HTMLDialogElement | null = null;
    let opener: HTMLElement | null = null;
    let large: HTMLImageElement | null = null;
    let caption: HTMLElement | null = null;
    let counter: HTMLElement | null = null;
    let index = 0;
    let swiped = false;
    let startX: number | null = null;
    const preloads: HTMLImageElement[] = [];

    function captionOf(image: HTMLImageElement): string {
      const figure = image.closest('figure');
      if (figure !== null && el.contains(figure)) {
        const written = figure.querySelector('figcaption');
        const text = written === null ? '' : written.textContent.trim();
        if (text !== '') return text;
      }
      return single ? '' : image.alt.trim();
    }

    function preload(at: number): void {
      const item = items[(at + count) % count];
      if (item === undefined) return;
      const ahead = page.createElement('img');
      ahead.decoding = 'async';
      ahead.src = srcOf(item.image);
      preloads.push(ahead);
    }

    /* Show image `at`; `step` is +1 / -1 for a move (it picks the slide-in side), 0 to open. */
    function render(at: number, step: number): void {
      const dialog = open;
      if (dialog === null) return;
      index = (at + count) % count;
      const item = items[index];
      if (item === undefined) return;
      const picture = item.image;
      const next = page.createElement('img');
      next.src = srcOf(picture);
      const srcset = picture.getAttribute('srcset');
      if (srcset !== null && srcset !== '') {
        next.setAttribute('srcset', srcset);
        next.setAttribute('sizes', '92vw');
      }
      next.alt = picture.alt;
      if (step !== 0) {
        next.setAttribute('data-ck-lightbox-step', '');
        next.style.setProperty('--ck-lightbox-from', String(step * (rtl ? -1 : 1)));
      }
      if (large === null) dialog.prepend(next);
      else large.replaceWith(next);
      large = next;
      dialog.setAttribute('aria-label', picture.alt !== '' ? picture.alt : arabic ? 'صورة' : 'Image');
      if (caption !== null) {
        const text = captionOf(picture);
        caption.textContent = text;
        caption.hidden = text === '';
      }
      if (counter !== null) counter.textContent = `${digits(lang, index + 1)} / ${digits(lang, count)}`;
      if (group) {
        preloads.length = 0;
        preload(index + 1);
        preload(index - 1);
      }
    }

    function close(): void {
      const dialog = open;
      if (dialog === null) return;
      open = null;
      large = null;
      caption = null;
      counter = null;
      preloads.length = 0;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      dialog.remove();
      const back = opener;
      opener = null;
      if (back !== null) back.focus();
    }

    function move(step: number): void {
      if (open === null || !group) return;
      render(index + step, step);
    }

    function navButton(kind: 'prev' | 'next'): HTMLButtonElement {
      const button = page.createElement('button');
      button.type = 'button';
      button.setAttribute('data-ck-lightbox-nav', kind);
      button.setAttribute(
        'aria-label',
        kind === 'prev' ? (arabic ? 'السابق' : 'Previous') : arabic ? 'التالي' : 'Next',
      );
      const glyph = page.createElement('span');
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = kind === 'prev' ? '‹' : '›';
      button.append(glyph);
      button.addEventListener('click', function stepped(event) {
        event.stopPropagation();
        move(kind === 'prev' ? -1 : 1);
      });
      return button;
    }

    function show(event: Event, at: number): void {
      event.preventDefault();
      if (open !== null) return;
      opener = items[at]?.trigger ?? el;
      const dialog = page.createElement('dialog');
      dialog.setAttribute('data-ck-lightbox', '');
      dialog.setAttribute('dir', rtl ? 'rtl' : 'ltr');
      const button = page.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', arabic ? 'إغلاق' : 'Close');
      button.textContent = '×';
      /* A single lightbox keeps its old markup (image + close) unless its figure has a caption. */
      const first = items[at];
      if (group || (first !== undefined && captionOf(first.image) !== '')) {
        caption = page.createElement('p');
        caption.setAttribute('data-ck-lightbox-caption', '');
        dialog.append(caption);
      }
      if (group) {
        dialog.setAttribute('data-ck-lightbox-group', '');
        counter = page.createElement('span');
        counter.setAttribute('data-ck-lightbox-counter', '');
        counter.setAttribute('aria-live', 'polite');
        counter.setAttribute('aria-atomic', 'true');
        dialog.append(counter, navButton('prev'), navButton('next'));
      }
      dialog.append(button);
      page.body.appendChild(dialog);
      open = dialog;
      render(at, 0);
      dialog.addEventListener('click', function clicked() {
        if (swiped) {
          swiped = false;
          return;
        }
        close();
      });
      dialog.addEventListener('close', close);
      dialog.addEventListener('keydown', function keyed(keyEvent) {
        if (!group) return;
        const key = keyEvent.key;
        let step = 0;
        if (key === 'ArrowRight') step = rtl ? -1 : 1;
        else if (key === 'ArrowLeft') step = rtl ? 1 : -1;
        else if (key === 'Home') step = -index;
        else if (key === 'End') step = count - 1 - index;
        else return;
        keyEvent.preventDefault();
        if (step !== 0) render(index + step, step > 0 ? 1 : -1);
      });
      dialog.addEventListener('pointerdown', function pressed(pointer) {
        swiped = false;
        const type = pointer.pointerType;
        startX = group && (type === 'touch' || type === 'pen') ? pointer.clientX : null;
      });
      dialog.addEventListener('pointercancel', function cancelled() {
        startX = null;
      });
      dialog.addEventListener('pointerup', function released(pointer) {
        if (startX === null) return;
        const dx = pointer.clientX - startX;
        startX = null;
        if (Math.abs(dx) < SWIPE) return;
        swiped = true;
        /* A swipe toward the inline start shows the next image: leftward in LTR, rightward in RTL. */
        const forward = rtl ? dx > 0 : dx < 0;
        move(forward ? 1 : -1);
      });
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
      button.focus();
    }

    items.forEach(function wire(item, at) {
      const trigger = item.trigger;
      if (trigger.tagName !== 'BUTTON' && trigger.tagName !== 'A') {
        if (trigger.getAttribute('tabindex') === null) setAttr(trigger, 'tabindex', '0');
        if (trigger.getAttribute('role') === null) setAttr(trigger, 'role', 'button');
      }
      setAttr(trigger, 'aria-haspopup', 'dialog');
      if (group && trigger === item.image && item.image.alt === '' && trigger.getAttribute('aria-label') === null) {
        setAttr(trigger, 'aria-label', arabic ? `فتح الصورة ${digits(lang, at + 1)}` : `Open image ${String(at + 1)}`);
      }
      listen(trigger, 'click', function clicked(event) {
        show(event, at);
      });
      listen(trigger, 'keydown', function keyed(event) {
        const pressed = (event as KeyboardEvent).key;
        if (trigger.tagName !== 'BUTTON' && (pressed === 'Enter' || pressed === ' ')) show(event, at);
      });
    });
    if (!el.hasAttribute(MARK)) setAttr(el, MARK, '');
    cleanups.push(function unlightbox() {
      const dialog = open;
      open = null;
      opener = null;
      preloads.length = 0;
      if (dialog !== null) dialog.remove();
    });
  }

  const found: Element[] = [];
  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) found.push(root as Element);
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
