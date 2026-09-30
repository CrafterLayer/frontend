/**
 * The site-behaviour runtime: the curated scripts a custom-code tree may NAME
 * with `data-ck-behavior` (the closed enum `CUSTOM_CODE_BEHAVIORS` in
 * @craftkit/builder-schema) and never write.
 *
 * ## Why one self-contained function
 *
 * The same code runs in two places: the editing canvas (`CustomCode` mounts it
 * on its region in an effect) and every exported page (`behaviorRuntimeScript()`
 * serialises it with `Function.prototype.toString` into one inline script). So
 * this function has NO imports and reads NO module-scope identifier — every
 * helper is declared inside it. `script.test.ts` evaluates the serialised form
 * in a fresh document to hold that true.
 *
 * ## Rules every behaviour keeps
 *
 * - Progressive enhancement: the content reads without the script. The hidden
 *   state of a reveal is gated on the mount marker AND on
 *   `prefers-reduced-motion: no-preference` in behaviors.css.
 * - Reduced motion: reveal, stagger and marquee render static, count-up shows
 *   its final value at once.
 * - Direction from `getComputedStyle(el).direction` (the `dir` attribute is the
 *   fallback where a DOM computes no direction): marquee and carousel move the
 *   other way in RTL, and the tab arrows mirror.
 * - Idempotent: a mounted element carries `data-ck-mounted`; mounting again is
 *   a no-op for it.
 * - The returned disposer removes every listener, observer, timer, clone and
 *   dialog, and restores each attribute it set — unless the host (React) has
 *   since rewritten it, in which case the host's value stands.
 *
 * ## Carousel buttons
 *
 * The vocabulary admits no `data-ck-carousel-prev/next`, so the buttons are
 * DERIVED: the track is the first element child that is not a button or a row
 * of buttons, and the buttons are every `<button>` inside the carousel but
 * outside the track — the first is "previous", the last is "next". The first
 * button sits at the inline start (the right in RTL), so it always means
 * "back"; what flips in RTL is the physical scroll direction.
 *
 * ## Tabs structure
 *
 * The first element child holding buttons is the tab list; its buttons are the
 * tabs; the element children after it are the panels, in order.
 */
export function mountBehaviors(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null) return function noop() {
      // Nothing was mounted, so there is nothing to undo.
    };
  const view: Window = win;
  const page: Document = doc;
  /* The editing canvas passes false: a click there selects, it does not open WhatsApp. */
  const interactive = options?.interactive !== false;
  const MARK = 'data-ck-mounted';
  const cleanups: (() => void)[] = [];
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    passive?: boolean,
  ): void {
    const opts: AddEventListenerOptions | boolean = passive === true ? { passive: true } : false;
    target.addEventListener(type, handler, opts);
    cleanups.push(function unlisten() {
      target.removeEventListener(type, handler, opts);
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

  function langOf(el: Element): string | undefined {
    const owner = el.closest('[lang]');
    const lang = owner === null ? '' : (owner.getAttribute('lang') ?? '');
    const chosen = lang !== '' ? lang : page.documentElement.lang;
    if (chosen === '') return undefined;
    /*
      Arabic pages count in Arabic-Indic digits (١٥٠٠). Current CLDR gives
      bare `ar` Latin digits, so the numbering system is named — except where
      the region writes Latin digits (the Maghreb) or the tag already chose.
    */
    if (/^ar(?:-|$)/iu.test(chosen) && !/-u-/iu.test(chosen) && !/^ar-(?:MA|DZ|TN|LY|EH)\b/iu.test(chosen)) {
      return `${chosen}-u-nu-arab`;
    }
    return chosen;
  }

  function formatNumber(
    lang: string | undefined,
    value: number,
    decimals: number,
    pad?: number,
  ): string {
    try {
      return new Intl.NumberFormat(lang, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        ...(pad === undefined ? {} : { minimumIntegerDigits: pad, useGrouping: false }),
      }).format(value);
    } catch {
      const fixed = value.toFixed(decimals);
      return pad === undefined ? fixed : fixed.padStart(pad, '0');
    }
  }

  function speedOf(el: Element, slow: number, normal: number, fast: number): number {
    const speed = el.getAttribute('data-ck-speed');
    return speed === 'slow' ? slow : speed === 'fast' ? fast : normal;
  }

  /* Calls `enter` once the element is on screen — at once without an observer. */
  function whenSeen(el: Element, enter: () => void): void {
    const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    if (reduced || typeof Observer !== 'function') {
      enter();
      return;
    }
    const observer = new Observer(
      function seen(entries: IntersectionObserverEntry[]) {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          enter();
          return;
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    cleanups.push(function unobserve() {
      observer.disconnect();
    });
  }

  /* The text node a number is written into; restored on dispose if the host left it alone. */
  function textSlot(el: Element): { write(text: string): void; original: string } {
    const walker = page.createTreeWalker(el, 4);
    let chosen: Text | null = null;
    let firstFilled: Text | null = null;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const value = node.nodeValue ?? '';
      if (firstFilled === null && /\S/u.test(value)) firstFilled = node as Text;
      if (/[0-9٠-٩۰-۹]/u.test(value)) {
        chosen = node as Text;
        break;
      }
    }
    let slot = chosen ?? firstFilled;
    let created = false;
    if (slot === null) {
      slot = page.createTextNode('');
      el.appendChild(slot);
      created = true;
    }
    const node: Text = slot;
    const original = node.data;
    let last = original;
    cleanups.push(function restoreText() {
      if (created) {
        node.remove();
        return;
      }
      if (node.nodeValue === last) node.nodeValue = original;
    });
    return {
      original,
      write(text: string) {
        last = text;
        node.nodeValue = text;
      },
    };
  }

  /* ── the behaviours ─────────────────────────────────────────────────────── */

  function reveal(el: Element): void {
    whenSeen(el, function show() {
      el.classList.add('ck-in');
    });
    cleanups.push(function unreveal() {
      el.classList.remove('ck-in');
    });
  }

  function stagger(el: Element): void {
    const items = Array.from(el.children) as HTMLElement[];
    items.forEach(function index(item, at) {
      item.style.setProperty('--ck-i', String(Math.min(at, 12)));
      cleanups.push(function unindex() {
        item.style.removeProperty('--ck-i');
      });
    });
    reveal(el);
  }

  function countUp(el: Element): void {
    const written = el.getAttribute('data-ck-to') ?? '';
    const target = Number(written);
    if (written.trim() === '' || !Number.isFinite(target)) return;
    const decimals = (written.split('.')[1] ?? '').replace(/[^0-9]/gu, '').length;
    const lang = langOf(el);
    const slot = textSlot(el);
    const shape = /^([^0-9٠-٩۰-۹]*)[0-9٠-٩۰-۹][0-9٠-٩۰-۹.,٫٬]*(.*)$/su.exec(
      slot.original,
    );
    const prefix = shape === null ? '' : (shape[1] ?? '');
    const suffix = shape === null ? '' : (shape[2] ?? '');
    function show(value: number): void {
      slot.write(prefix + formatNumber(lang, value, decimals) + suffix);
    }
    if (reduced) {
      show(target);
      return;
    }
    show(0);
    const duration = speedOf(el, 2600, 1600, 900);
    let frame = 0;
    whenSeen(el, function start() {
      const began = view.performance.now();
      const raf =
        typeof view.requestAnimationFrame === 'function'
          ? view.requestAnimationFrame.bind(view)
          : function later(step: FrameRequestCallback) {
              return view.setTimeout(function tick() {
                step(view.performance.now());
              }, 16);
            };
      function step(now: number): void {
        const progress = Math.min(1, (now - began) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        show(progress >= 1 ? target : target * eased);
        if (progress < 1) frame = raf(step);
      }
      frame = raf(step);
    });
    cleanups.push(function stopCount() {
      if (typeof view.cancelAnimationFrame === 'function') view.cancelAnimationFrame(frame);
      view.clearTimeout(frame);
    });
  }

  function countdown(el: Element): void {
    const until = Date.parse(el.getAttribute('data-ck-until') ?? '');
    if (Number.isNaN(until)) return;
    const lang = langOf(el);
    const slot = textSlot(el);
    if (el.getAttribute('aria-live') === null) setAttr(el, 'aria-live', 'polite');
    if (el.getAttribute('aria-atomic') === null) setAttr(el, 'aria-atomic', 'true');
    function render(): boolean {
      const left = Math.max(0, until - Date.now());
      const total = Math.floor(left / 1000);
      const days = Math.floor(total / 86400);
      const parts = [
        formatNumber(lang, Math.floor((total % 86400) / 3600), 0, 2),
        formatNumber(lang, Math.floor((total % 3600) / 60), 0, 2),
        formatNumber(lang, total % 60, 0, 2),
      ];
      const clock = (days > 0 ? formatNumber(lang, days, 0) + ':' : '') + parts.join(':');
      slot.write(clock);
      if (left === 0) setAttr(el, 'data-ck-done', '');
      return left > 0;
    }
    if (render()) {
      const id = view.setInterval(function tick() {
        if (!render()) view.clearInterval(id);
      }, 1000);
      cleanups.push(function stopClock() {
        view.clearInterval(id);
      });
    }
  }

  function marquee(el: HTMLElement): void {
    if (reduced) return;
    const originals = Array.from(el.children);
    if (originals.length === 0) return;
    for (const original of originals) {
      const clone = original.cloneNode(true) as Element;
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('data-ck-clone', '');
      clone.setAttribute('inert', '');
      clone.removeAttribute('id');
      for (const inner of Array.from(clone.querySelectorAll('[id]'))) inner.removeAttribute('id');
      el.appendChild(clone);
      cleanups.push(function unclone() {
        clone.remove();
      });
    }
    el.style.setProperty('--ck-marquee-dir', isRtl(el) ? '1' : '-1');
    function measure(): void {
      let gap = 0;
      try {
        gap = Number.parseFloat(view.getComputedStyle(el).columnGap) || 0;
      } catch {
        gap = 0;
      }
      const distance = (el.scrollWidth + gap) / 2;
      el.style.setProperty('--ck-marquee-distance', `${String(Math.max(0, distance))}px`);
    }
    measure();
    const Resize = (view as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (typeof Resize === 'function') {
      const observer = new Resize(measure);
      observer.observe(el);
      cleanups.push(function unmeasure() {
        observer.disconnect();
      });
    }
    cleanups.push(function unmarquee() {
      el.style.removeProperty('--ck-marquee-dir');
      el.style.removeProperty('--ck-marquee-distance');
    });
  }

  function carousel(el: Element): void {
    const rtl = isRtl(el);
    let track: Element = el;
    for (const child of Array.from(el.children)) {
      if (child.tagName === 'BUTTON') continue;
      const kids = Array.from(child.children);
      if (kids.length > 0 && kids.every((kid) => kid.tagName === 'BUTTON')) continue;
      track = child;
      break;
    }
    setAttr(track, 'data-ck-track', '');
    if (track.getAttribute('tabindex') === null) setAttr(track, 'tabindex', '0');
    const buttons = Array.from(el.querySelectorAll('button')).filter(
      (button) => track === el || !track.contains(button),
    );
    const prev = buttons.length >= 2 ? buttons[0] : undefined;
    const next = buttons.length >= 2 ? buttons[buttons.length - 1] : undefined;
    function go(forward: boolean): void {
      const step = Math.max(160, (track as HTMLElement).clientWidth * 0.85 || 0);
      const sign = (forward ? 1 : -1) * (rtl ? -1 : 1);
      const scroller = track as HTMLElement & { scrollBy?: unknown };
      if (typeof scroller.scrollBy === 'function') {
        scroller.scrollBy({ left: sign * step, behavior: reduced ? 'auto' : 'smooth' });
      } else {
        scroller.scrollLeft += sign * step;
      }
    }
    if (prev !== undefined) listen(prev, 'click', () => { go(false); });
    if (next !== undefined) listen(next, 'click', () => { go(true); });
  }

  function tabs(el: Element): void {
    let list: Element | undefined;
    for (const child of Array.from(el.children)) {
      if (child.querySelector('button') !== null || child.getAttribute('role') === 'tablist') {
        list = child;
        break;
      }
    }
    if (list === undefined) return;
    const tablist = list;
    const children = Array.from(el.children);
    const panels = children.slice(children.indexOf(tablist) + 1);
    const tabButtons = Array.from(tablist.querySelectorAll('button'));
    const count = Math.min(tabButtons.length, panels.length);
    if (count === 0) return;
    const stamp = Math.random().toString(36).slice(2, 8);
    setAttr(tablist, 'role', 'tablist');
    const pairs: { tab: HTMLButtonElement; panel: Element }[] = [];
    for (let at = 0; at < count; at += 1) {
      const tab = tabButtons[at];
      const panel = panels[at];
      if (tab === undefined || panel === undefined) continue;
      if (tab.id === '') setAttr(tab, 'id', `ck-tab-${stamp}-${String(at)}`);
      if (panel.id === '') setAttr(panel, 'id', `ck-panel-${stamp}-${String(at)}`);
      setAttr(tab, 'role', 'tab');
      setAttr(tab, 'aria-controls', panel.id);
      setAttr(panel, 'role', 'tabpanel');
      setAttr(panel, 'aria-labelledby', tab.id);
      if (panel.getAttribute('tabindex') === null) setAttr(panel, 'tabindex', '0');
      pairs.push({ tab, panel });
    }
    function select(index: number, focus: boolean): void {
      pairs.forEach(function mark(pair, at) {
        const on = at === index;
        setAttr(pair.tab, 'aria-selected', on ? 'true' : 'false');
        setAttr(pair.tab, 'tabindex', on ? '0' : '-1');
        setAttr(pair.panel, 'hidden', on ? null : '');
      });
      const chosen = pairs[index];
      if (focus && chosen !== undefined) chosen.tab.focus();
    }
    const preset = pairs.findIndex((pair) => pair.tab.getAttribute('aria-selected') === 'true');
    select(preset < 0 ? 0 : preset, false);
    pairs.forEach(function wire(pair, at) {
      listen(pair.tab, 'click', () => { select(at, false); });
    });
    listen(tablist, 'keydown', function keys(event) {
      const key = (event as KeyboardEvent).key;
      const current = pairs.findIndex((pair) => pair.tab === page.activeElement);
      if (current < 0) return;
      const rtl = isRtl(tablist);
      let target = -1;
      if (key === 'ArrowRight') target = rtl ? current - 1 : current + 1;
      else if (key === 'ArrowLeft') target = rtl ? current + 1 : current - 1;
      else if (key === 'Home') target = 0;
      else if (key === 'End') target = pairs.length - 1;
      else return;
      event.preventDefault();
      select((target + pairs.length) % pairs.length, true);
    });
  }

  function stickyHeader(el: Element): void {
    function check(): void {
      const scrolled = (view.scrollY || page.documentElement.scrollTop || 0) > 8;
      el.classList.toggle('ck-scrolled', scrolled);
    }
    check();
    listen(view, 'scroll', check, true);
    cleanups.push(function unstick() {
      el.classList.remove('ck-scrolled');
    });
  }

  function lightbox(el: HTMLElement): void {
    const image = el.tagName === 'IMG' ? (el as HTMLImageElement) : el.querySelector('img');
    if (image === null) return;
    const picture: HTMLImageElement = image;
    if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {
      if (el.getAttribute('tabindex') === null) setAttr(el, 'tabindex', '0');
      if (el.getAttribute('role') === null) setAttr(el, 'role', 'button');
    }
    setAttr(el, 'aria-haspopup', 'dialog');
    let open: HTMLDialogElement | null = null;
    function close(): void {
      const dialog = open;
      if (dialog === null) return;
      open = null;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      dialog.remove();
      el.focus();
    }
    function show(event: Event): void {
      event.preventDefault();
      if (open !== null) return;
      const arabic = (langOf(el) ?? '').toLowerCase().startsWith('ar');
      const dialog = page.createElement('dialog');
      dialog.setAttribute('data-ck-lightbox', '');
      dialog.setAttribute('aria-label', picture.alt !== '' ? picture.alt : arabic ? 'صورة' : 'Image');
      const large = page.createElement('img');
      large.src = picture.currentSrc !== '' ? picture.currentSrc : picture.src;
      large.alt = picture.alt;
      const button = page.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', arabic ? 'إغلاق' : 'Close');
      button.textContent = '×';
      dialog.append(large, button);
      page.body.appendChild(dialog);
      open = dialog;
      dialog.addEventListener('click', close);
      dialog.addEventListener('close', close);
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
    listen(el, 'click', show);
    listen(el, 'keydown', function key(event) {
      const pressed = (event as KeyboardEvent).key;
      if (el.tagName !== 'BUTTON' && (pressed === 'Enter' || pressed === ' ')) show(event);
    });
    cleanups.push(function unlightbox() {
      const dialog = open;
      open = null;
      if (dialog !== null) dialog.remove();
    });
  }

  function whatsappForm(el: Element): void {
    const digits = (el.getAttribute('data-ck-phone') ?? '').replace(/[^0-9]/gu, '');
    if (digits.length < 7) return;
    function send(event: Event): void {
      event.preventDefault();
      const scope: ParentNode | null =
        el.tagName === 'FORM' ? el : (el.closest('form') ?? el.parentElement);
      const lines: string[] = [];
      const lead = el.getAttribute('data-ck-text');
      if (lead !== null && lead.trim() !== '') lines.push(lead.trim());
      const fields = scope === null ? [] : Array.from(scope.querySelectorAll('input, textarea, select'));
      for (const field of fields) {
        const input = field as HTMLInputElement;
        const type = (input.type || '').toLowerCase();
        if (['hidden', 'submit', 'button', 'reset', 'password', 'file'].includes(type)) continue;
        if ((type === 'checkbox' || type === 'radio') && !input.checked) continue;
        const value = (input.value || '').trim();
        if (value === '') continue;
        const labelled = input.labels?.[0];
        const label =
          input.getAttribute('aria-label') ??
          (labelled !== undefined ? labelled.textContent.trim() : '');
        const name = label !== '' ? label : (input.getAttribute('placeholder') ?? input.name);
        lines.push(name !== '' ? `${name}: ${value}` : value);
      }
      const url = `https://wa.me/${digits}${lines.length > 0 ? `?text=${encodeURIComponent(lines.join('\n'))}` : ''}`;
      view.open(url, '_blank', 'noopener,noreferrer');
    }
    listen(el, el.tagName === 'FORM' ? 'submit' : 'click', send);
  }

  function copyText(el: Element): void {
    let reset = 0;
    function done(): void {
      el.classList.add('ck-copied');
      view.clearTimeout(reset);
      reset = view.setTimeout(function clear() {
        el.classList.remove('ck-copied');
      }, 1600);
    }
    function fallback(value: string): void {
      const area = page.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      page.body.appendChild(area);
      area.select();
      try {
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only copy path a page has without the Clipboard API
        page.execCommand('copy');
        done();
      } catch {
        // Nothing more a page can do without the Clipboard API.
      }
      area.remove();
    }
    listen(el, 'click', function copy(event) {
      event.preventDefault();
      const value = (el.getAttribute('data-ck-text') ?? el.textContent).trim();
      const clipboard = view.navigator.clipboard as Clipboard | undefined;
      if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
        clipboard.writeText(value).then(done, () => { fallback(value); });
      } else {
        fallback(value);
      }
    });
    cleanups.push(function uncopy() {
      view.clearTimeout(reset);
      el.classList.remove('ck-copied');
    });
  }

  /* ── mount ─────────────────────────────────────────────────────────────── */

  const found: Element[] = [];
  if ((root as Node).nodeType === 1 && (root as Element).hasAttribute('data-ck-behavior')) {
    found.push(root as Element);
  }
  found.push(...Array.from(root.querySelectorAll('[data-ck-behavior]')));
  for (const el of found) {
    if (el.hasAttribute(MARK) || el.hasAttribute('data-ck-clone')) continue;
    if (el.closest('[data-ck-clone]') !== null) continue;
    const behavior = el.getAttribute('data-ck-behavior');
    const html = el as HTMLElement;
    let mounted = true;
    if (behavior === 'reveal') reveal(el);
    else if (behavior === 'stagger') stagger(el);
    else if (behavior === 'count-up') countUp(el);
    else if (behavior === 'countdown') countdown(el);
    else if (behavior === 'marquee') marquee(html);
    else if (behavior === 'carousel') carousel(el);
    else if (behavior === 'tabs') tabs(el);
    else if (behavior === 'sticky-header') stickyHeader(el);
    else if (behavior === 'lightbox' && interactive) lightbox(html);
    else if (behavior === 'whatsapp-form' && interactive) whatsappForm(el);
    else if (behavior === 'copy-text' && interactive) copyText(el);
    else mounted = false;
    if (mounted) setAttr(el, MARK, reduced ? 'static' : '');
  }

  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = cleanups.length - 1; at >= 0; at -= 1) {
      const cleanup = cleanups[at];
      try {
        if (cleanup !== undefined) cleanup();
      } catch {
        // One failing cleanup must not strand the others.
      }
    }
    cleanups.length = 0;
    restoreAttrs();
  };
}
