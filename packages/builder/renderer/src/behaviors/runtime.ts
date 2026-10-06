/**
 * The site-behaviour runtime: the curated scripts a custom-code tree may NAME
 * with `data-ck-behavior` (the closed enum `CUSTOM_CODE_BEHAVIORS` in
 * @craftkit/builder-schema) and never write.
 *
 * It also carries the JavaScript half of the motion presets
 * (`data-ck-motion`, `data-ck-hover`, `ck-fx-spotlight`; style-manager
 * DESIGN.md §B): child indexes, "seen"/"done" for view triggers, click /
 * hover triggers (`data-ck-play`, optionally on `data-ck-target`), split
 * text, typewriter, word rotation, meteors, line drawing, tilt, magnetic and
 * spotlight pointer variables. The CSS half is `../motion/presets-css.ts`.
 * Under reduced motion every motion part is inert; on the canvas
 * (`interactive: false`) the region is marked `data-ck-still`, nothing plays,
 * and a Preview (`data-ck-play`) plays it — DOM-rebuilding presets are built
 * for the preview only.
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
 * ## Carousel and lightbox
 *
 * media-motion (2026-10-06): `carousel` and `lightbox` moved into their own
 * packs (`packs/carousel.ts`, `packs/gallery.ts`), mounted beside this
 * function by `mountSiteBehaviors` and serialised after it by `script.ts`.
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
  /* The editing canvas shows FINAL states: nothing plays until Preview sets data-ck-play. */
  const still = !interactive;
  /* Pointer-follow effects (tilt, magnetic, spotlight) only for a fine pointer that hovers. */
  const fine =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(hover: hover) and (pointer: fine)').matches;

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
  function textSlot(el: Element): { write(text: string): void; original: string; node: Text } {
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
      node,
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

  /* ── new behaviours: ticker (rolling digits) and layout (FLIP) ──────────── */

  /*
    Rolling digits — the idea of NumberFlow (MIT, Maxwell Barvian) and Magic
    UI's number-ticker (MIT): every digit is a column of 0–9 that slides to its
    value. The digits are the page language's own (Arabic-Indic on an Arabic
    page); the columns are aria-hidden and the element's aria-label carries
    the final value. Reduced motion (and the canvas) write the value at once.
  */
  function ticker(el: HTMLElement): void {
    const written = el.getAttribute('data-ck-to') ?? '';
    const target = Number(written);
    if (written.trim() === '' || !Number.isFinite(target)) return;
    const decimals = (written.split('.')[1] ?? '').replace(/[^0-9]/gu, '').length;
    const lang = langOf(el);
    const slot = textSlot(el);
    const shape = /^([^0-9٠-٩۰-۹]*)[0-9٠-٩۰-۹][0-9٠-٩۰-۹.,٫٬]*(.*)$/su.exec(slot.original);
    const prefix = shape === null ? '' : (shape[1] ?? '');
    const suffix = shape === null ? '' : (shape[2] ?? '');
    const finalText = prefix + formatNumber(lang, target, decimals) + suffix;
    if (reduced || still) {
      slot.write(finalText);
      return;
    }
    if (el.getAttribute('aria-label') === null) setAttr(el, 'aria-label', finalText);
    const digits: string[] = [];
    for (let digit = 0; digit <= 9; digit += 1) digits.push(formatNumber(lang, digit, 0));
    const box = page.createElement('span');
    box.className = 'ck-ticker';
    box.setAttribute('aria-hidden', 'true');
    const strips: { strip: HTMLElement; digit: number }[] = [];
    for (const character of Array.from(finalText)) {
      const digit = digits.indexOf(character);
      if (digit < 0) {
        const symbol = page.createElement('span');
        symbol.className = 'ck-tick-sym';
        symbol.textContent = character;
        box.appendChild(symbol);
        continue;
      }
      const column = page.createElement('span');
      column.className = 'ck-tick-col';
      const strip = page.createElement('span');
      strip.className = 'ck-tick-strip';
      for (const face of digits) {
        const cell = page.createElement('span');
        cell.textContent = face;
        strip.appendChild(cell);
      }
      column.appendChild(strip);
      box.appendChild(column);
      strips.push({ strip, digit });
    }
    slot.write('');
    slot.node.after(box);
    whenSeen(el, function roll() {
      for (const item of strips) item.strip.style.setProperty('--ck-d', String(item.digit));
    });
    cleanups.push(function unticker() {
      box.remove();
    });
  }

  /*
    FLIP on layout change — the idea of auto-animate (MIT, FormKit): remember
    where each child sat, and when the children change (added, removed,
    reordered, shown, hidden) play each moved child from its old place to its
    new one with the Web Animations API. auto-animate documents no
    reduced-motion guard; ours does nothing under reduced motion or on the
    canvas.
  */
  function layout(el: HTMLElement): void {
    if (reduced || still) return;
    const Mutation = (view as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (typeof Mutation !== 'function') return;
    const places = new Map<Element, { x: number; y: number }>();
    function measure(): void {
      places.clear();
      for (const child of Array.from(el.children)) {
        const box = child as HTMLElement;
        places.set(child, { x: box.offsetLeft, y: box.offsetTop });
      }
    }
    measure();
    const duration = speedOf(el, 450, 300, 180);
    const easing = 'cubic-bezier(0.2, 0, 0, 1)';
    const observer = new Mutation(function moved() {
      for (const child of Array.from(el.children)) {
        const box = child as HTMLElement;
        if (typeof box.animate !== 'function' || box.hidden) continue;
        const before = places.get(child);
        if (before === undefined) {
          box.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], {
            duration,
            easing,
          });
          continue;
        }
        const dx = before.x - box.offsetLeft;
        const dy = before.y - box.offsetTop;
        if (Math.abs(dx) + Math.abs(dy) < 1) continue;
        box.animate(
          [{ transform: `translate(${String(dx)}px, ${String(dy)}px)` }, { transform: 'none' }],
          { duration, easing },
        );
      }
      measure();
    });
    observer.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'open', 'class', 'aria-expanded'],
    });
    listen(view, 'resize', measure, true);
    cleanups.push(function unlayout() {
      observer.disconnect();
    });
  }

  /* ── motion presets (data-ck-motion / data-ck-hover) ───────────────────── */

  /** JS-driven presets that restart on `data-ck-play` (click, hover, Preview). */
  const replayers = new Map<Element, () => void>();

  /** Reading a layout property flushes styles: the "one pass without" a replay needs. */
  function reflow(el: Element): number {
    return (el as HTMLElement).offsetWidth;
  }

  /** Play (or replay) an element's preset: drop data-ck-play for one style pass, then set it. */
  function play(target: Element): void {
    setAttr(target, 'data-ck-play', null);
    reflow(target);
    setAttr(target, 'data-ck-play', String(Math.floor(view.performance.now())));
    const again = replayers.get(target);
    if (again !== undefined) again();
  }

  /** `data-ck-target`: an id in the same tree (the door checks it); the element itself otherwise. */
  function targetOf(el: Element): Element {
    const id = el.getAttribute('data-ck-target');
    if (id === null || id === '') return el;
    for (const candidate of Array.from(root.querySelectorAll('[id]'))) {
      if (candidate.id === id) return candidate;
    }
    return el;
  }

  /*
    Seen / done, for view-triggered presets. `data-ck-inview` drives the
    time-based path (browsers without view timelines, and the text presets);
    `data-ck-done` tells a view()-scrubbed element it has passed the end of
    its range, so (once) it rests at its final state instead of reversing when
    the reader scrolls back. With data-ck-once="false" leaving the viewport
    re-arms it: its animation is dropped for one style pass so the next entry
    starts from the first frame.
  */
  function observeView(el: Element, once: boolean): void {
    const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    if (typeof Observer !== 'function') {
      setAttr(el, 'data-ck-inview', '');
      return;
    }
    const speed = el.getAttribute('data-ck-speed');
    const end =
      (speed === 'fast' ? 0.2 : speed === 'slow' ? 0.45 : 0.3) +
      (Number(el.getAttribute('data-ck-delay') ?? '0') || 0) * 0.05;
    const observer = new Observer(
      function seen(entries: IntersectionObserverEntry[]) {
        for (const entry of entries) {
          const box = entry.boundingClientRect;
          const height = entry.rootBounds === null ? view.innerHeight : entry.rootBounds.height;
          if (entry.isIntersecting) {
            if (!el.hasAttribute('data-ck-inview')) setAttr(el, 'data-ck-inview', '');
            if (once && box.top <= height - end * (height + box.height)) {
              setAttr(el, 'data-ck-done', '');
              observer.disconnect();
            }
          } else if (once && box.bottom < 0) {
            setAttr(el, 'data-ck-inview', '');
            setAttr(el, 'data-ck-done', '');
            observer.disconnect();
          } else if (!once && el.hasAttribute('data-ck-inview')) {
            setAttr(el, 'data-ck-rearm', '');
            reflow(el);
            setAttr(el, 'data-ck-rearm', null);
            setAttr(el, 'data-ck-inview', null);
          }
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    cleanups.push(function unobserveView() {
      observer.disconnect();
    });
  }

  /** Children get `--ck-i` (row + column for a grid) and the host `--ck-n`. */
  function indexChildren(el: HTMLElement, grid: boolean, cap: number): void {
    const items = Array.from(el.children).filter(
      (child) =>
        !child.hasAttribute('data-ck-clone') &&
        !child.classList.contains('ck-sr') &&
        !child.classList.contains('ck-meteor'),
    ) as HTMLElement[];
    el.style.setProperty('--ck-n', String(items.length));
    const rows: number[] = [];
    if (grid) {
      for (const item of items) if (!rows.includes(item.offsetTop)) rows.push(item.offsetTop);
      rows.sort((a, b) => a - b);
    }
    const columns = new Map<number, number>();
    items.forEach(function index(item, at) {
      let value = at;
      if (grid) {
        const row = rows.indexOf(item.offsetTop);
        const column = columns.get(row) ?? 0;
        columns.set(row, column + 1);
        value = row + column;
      }
      item.style.setProperty('--ck-i', String(Math.min(value, cap)));
    });
    cleanups.push(function unindexChildren() {
      el.style.removeProperty('--ck-n');
      for (const item of items) item.style.removeProperty('--ck-i');
    });
  }

  /*
    Scripts whose letters JOIN (Arabic, Syriac, N'Ko, Mongolian) or build
    clusters (the Indic scripts) cannot be cut into one span per character
    without breaking their shapes, so split-chars falls back to words there.
  */
  const JOINING = /[؀-ۿ܀-ݏݐ-ݿ߀-߿ࡰ-ࣿऀ-෿᠀-᢯ﭐ-﷿ﹰ-﻿]/u;

  function graphemes(text: string): string[] {
    const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
    if (typeof Segmenter !== 'function') return Array.from(text);
    return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
  }

  /*
    Split text into spans — the technique of Splitting.js (MIT, Stephen
    Shaw): each unit becomes a span carrying its index as a custom property
    (`--ck-char-i`, `--ck-word-i`, `--ck-line-i`, and `--ck-u-i` for the
    animated unit), the spans are aria-hidden, and the parent's aria-label
    keeps the sentence whole for assistive technology. The original text
    nodes stay where they are, emptied, so a host that owns them (React) can
    still update or remove them; dispose removes the spans and refills a node
    the host has not rewritten.
  */
  function splitText(el: HTMLElement, unit: 'chars' | 'words' | 'lines'): void {
    const sentence = el.textContent.replace(/\s+/gu, ' ').trim();
    if (sentence === '') return;
    const byChars = unit === 'chars' && !JOINING.test(sentence);
    const walker = page.createTreeWalker(el, 4);
    const texts: Text[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent !== null && parent.closest('svg, script, style, .ck-sr, .ck-w') !== null) continue;
      if (/\S/u.test(node.nodeValue ?? '')) texts.push(node as Text);
    }
    const words: HTMLElement[] = [];
    const added: Node[] = [];
    const emptied: { node: Text; value: string }[] = [];
    let wordAt = 0;
    let charAt = 0;
    for (const text of texts) {
      const value = text.data;
      const pieces: Node[] = [];
      for (const piece of value.split(/(\s+)/u)) {
        if (piece === '') continue;
        if (/^\s+$/u.test(piece)) {
          pieces.push(page.createTextNode(piece));
          continue;
        }
        const word = page.createElement('span');
        word.className = byChars ? 'ck-w' : 'ck-w ck-u';
        word.setAttribute('aria-hidden', 'true');
        word.style.setProperty('--ck-word-i', String(wordAt));
        if (byChars) {
          for (const character of graphemes(piece)) {
            const span = page.createElement('span');
            span.className = 'ck-u ck-c';
            span.textContent = character;
            span.style.setProperty('--ck-char-i', String(charAt));
            span.style.setProperty('--ck-u-i', String(charAt));
            charAt += 1;
            word.appendChild(span);
          }
        } else {
          word.textContent = piece;
          word.style.setProperty('--ck-u-i', String(wordAt));
        }
        wordAt += 1;
        words.push(word);
        pieces.push(word);
      }
      text.after(...pieces);
      added.push(...pieces);
      emptied.push({ node: text, value });
      text.nodeValue = '';
    }
    /* Lines: words that share a top edge share a line; re-measured on resize. */
    function lines(): void {
      const tops: number[] = [];
      for (const word of words) if (!tops.includes(word.offsetTop)) tops.push(word.offsetTop);
      tops.sort((a, b) => a - b);
      for (const word of words) {
        const line = String(tops.indexOf(word.offsetTop));
        word.style.setProperty('--ck-line-i', line);
        word.style.setProperty('--ck-u-i', line);
      }
    }
    if (unit === 'lines') {
      lines();
      listen(view, 'resize', lines, true);
    }
    if (unit === 'chars' && !byChars) el.style.setProperty('--ck-u-step', '80ms');
    const labelled = el.getAttribute('aria-label') === null;
    if (labelled) el.setAttribute('aria-label', sentence);
    cleanups.push(function unsplit() {
      for (const node of added) node.parentNode?.removeChild(node);
      for (const item of emptied) if (item.node.nodeValue === '') item.node.nodeValue = item.value;
      if (labelled && el.getAttribute('aria-label') === sentence) el.removeAttribute('aria-label');
      el.style.removeProperty('--ck-u-step');
    });
  }

  /*
    Typewriter: the sentence is typed into an aria-hidden span (its caret is
    CSS) while the element's aria-label holds the whole of it. Text-only
    elements: inner markup cannot be typed without being destroyed.
  */
  function typewriter(el: HTMLElement, trigger: string): void {
    if (el.children.length > 0) return;
    const sentence = el.textContent;
    if (sentence.trim() === '') return;
    const letters = graphemes(sentence);
    const emptied: { node: Text; value: string }[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== 3) continue;
      emptied.push({ node: node as Text, value: node.nodeValue ?? '' });
      node.nodeValue = '';
    }
    const typed = page.createElement('span');
    typed.className = 'ck-tw';
    typed.setAttribute('aria-hidden', 'true');
    el.appendChild(typed);
    const labelled = el.getAttribute('aria-label') === null;
    if (labelled) el.setAttribute('aria-label', sentence.trim());
    const step = speedOf(el, 90, 55, 30);
    const wait = (Number(el.getAttribute('data-ck-delay') ?? '0') || 0) * 80;
    let timer = 0;
    function run(): void {
      view.clearTimeout(timer);
      let at = 0;
      typed.textContent = '';
      function tick(): void {
        at += 1;
        typed.textContent = letters.slice(0, at).join('');
        if (at < letters.length) timer = view.setTimeout(tick, step);
      }
      timer = view.setTimeout(tick, wait);
    }
    replayers.set(el, run);
    if (trigger === 'click' || trigger === 'hover') typed.textContent = sentence;
    else if (trigger === 'load') run();
    else whenSeen(el, run);
    cleanups.push(function untype() {
      view.clearTimeout(timer);
      replayers.delete(el);
      typed.remove();
      for (const item of emptied) if (item.node.nodeValue === '') item.node.nodeValue = item.value;
      if (labelled && el.getAttribute('aria-label') === sentence.trim()) el.removeAttribute('aria-label');
    });
  }

  /*
    Word rotate (Magic UI word-rotate, MIT): the words are the element's
    element children, or "a|b|c" text the runtime turns into spans. One word
    shows at a time (`data-ck-on`); a visually hidden `.ck-sr` span reads all
    of them. Under reduced motion it is built but never turns.
  */
  function wordRotate(el: HTMLElement): void {
    let words = Array.from(el.children).filter((child) => !child.classList.contains('ck-sr'));
    const added: Node[] = [];
    const emptied: { node: Text; value: string }[] = [];
    if (words.length < 2) {
      const parts = el.textContent
        .split('|')
        .map((part) => part.trim())
        .filter((part) => part !== '');
      /* Text mode rebuilds the host's text, so the canvas leaves the authored "a|b|c" alone. */
      if (parts.length < 2 || el.children.length > 0 || still) return;
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType !== 3) continue;
        emptied.push({ node: node as Text, value: node.nodeValue ?? '' });
        node.nodeValue = '';
      }
      words = parts.map(function word(part) {
        const span = page.createElement('span');
        span.className = 'ck-wr-word';
        span.textContent = part;
        el.appendChild(span);
        added.push(span);
        return span;
      });
    }
    const all = page.createElement('span');
    all.className = 'ck-sr';
    all.textContent = words.map((word) => word.textContent.trim()).join(', ');
    el.appendChild(all);
    added.push(all);
    for (const word of words) setAttr(word, 'aria-hidden', 'true');
    let current = 0;
    const first = words[0];
    if (first !== undefined) setAttr(first, 'data-ck-on', '');
    cleanups.push(function unrotate() {
      for (const node of added) node.parentNode?.removeChild(node);
      for (const item of emptied) if (item.node.nodeValue === '') item.node.nodeValue = item.value;
    });
    if (reduced || still) return;
    const every = speedOf(el, 3600, 2500, 1600);
    const id = view.setInterval(function turn() {
      let held = false;
      try {
        held = el.matches(':hover, :focus-within');
      } catch {
        held = false;
      }
      if (held) return;
      const leaving = words[current];
      current = (current + 1) % words.length;
      const coming = words[current];
      if (leaving !== undefined) setAttr(leaving, 'data-ck-on', null);
      if (coming !== undefined) setAttr(coming, 'data-ck-on', '');
    }, every);
    cleanups.push(function stopRotate() {
      view.clearInterval(id);
    });
  }

  /* Magic UI meteors (MIT): random inline position, delay (0.2–1.2 s) and duration (2–10 s). */
  function meteors(el: HTMLElement): void {
    const count = Math.max(6, Math.min(24, Math.round((el.clientWidth || 720) / 60)));
    for (let at = 0; at < count; at += 1) {
      const meteor = page.createElement('span');
      meteor.className = 'ck-meteor';
      meteor.setAttribute('aria-hidden', 'true');
      meteor.style.setProperty('--ck-meteor-x', `${(Math.random() * 120).toFixed(1)}%`);
      meteor.style.setProperty('--ck-meteor-delay', `${(0.2 + Math.random()).toFixed(2)}s`);
      meteor.style.setProperty('--ck-meteor-dur', `${(2 + Math.random() * 8).toFixed(1)}s`);
      el.appendChild(meteor);
      cleanups.push(function unmeteor() {
        meteor.remove();
      });
    }
  }

  /* anime.js line drawing (MIT, Julian Garnier): pathLength="1" makes a dash of 1 the whole stroke. */
  function drawLine(el: Element): void {
    const shapes = 'path, line, polyline, polygon, circle, ellipse, rect';
    const all = [...(el.matches(shapes) ? [el] : []), ...Array.from(el.querySelectorAll(shapes))];
    for (const shape of all) setAttr(shape, 'pathLength', '1');
  }

  /* Pointer-follow variables, written only for a fine pointer. */
  function follow(el: HTMLElement, write: (x: number, y: number, box: DOMRect) => void, names: readonly string[]): void {
    if (!fine) return;
    function clear(): void {
      for (const name of names) el.style.removeProperty(name);
    }
    listen(
      el,
      'pointermove',
      function move(event) {
        const pointer = event as PointerEvent;
        if (pointer.pointerType !== 'mouse' && pointer.pointerType !== 'pen') return;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        write(pointer.clientX - box.left, pointer.clientY - box.top, box);
      },
      true,
    );
    listen(el, 'pointerleave', clear, true);
    cleanups.push(clear);
  }

  function hoverPreset(el: HTMLElement, preset: string): boolean {
    if (reduced || still) return false;
    if (preset === 'tilt') {
      follow(
        el,
        function tilt(x, y, box) {
          el.style.setProperty('--ck-tilt-x', `${((0.5 - y / box.height) * 10).toFixed(2)}deg`);
          el.style.setProperty('--ck-tilt-y', `${((x / box.width - 0.5) * 10).toFixed(2)}deg`);
        },
        ['--ck-tilt-x', '--ck-tilt-y'],
      );
      return true;
    }
    if (preset === 'magnetic') {
      follow(
        el,
        function pull(x, y, box) {
          const reach = Math.min(24, box.width * 0.3);
          el.style.setProperty('--ck-mag-x', `${((x / box.width - 0.5) * reach).toFixed(1)}px`);
          el.style.setProperty('--ck-mag-y', `${((y / box.height - 0.5) * reach).toFixed(1)}px`);
        },
        ['--ck-mag-x', '--ck-mag-y'],
      );
      return true;
    }
    return false;
  }

  function spotlight(el: HTMLElement): void {
    if (reduced) return;
    follow(
      el,
      function light(x, y) {
        el.style.setProperty('--ck-spot-x', `${x.toFixed(0)}px`);
        el.style.setProperty('--ck-spot-y', `${y.toFixed(0)}px`);
      },
      ['--ck-spot-x', '--ck-spot-y'],
    );
  }

  const SPLIT_UNIT: Readonly<Record<string, 'chars' | 'words' | 'lines'>> = {
    'split-chars': 'chars',
    'split-words': 'words',
    'split-lines': 'lines',
    'blur-words': 'words',
  };

  /** The presets that rebuild the DOM: never on the canvas, except during a Preview. */
  function rebuilds(preset: string): boolean {
    return preset in SPLIT_UNIT || preset === 'typewriter' || preset === 'meteors';
  }

  function rebuild(el: HTMLElement, preset: string, trigger: string): void {
    const unit = SPLIT_UNIT[preset];
    if (unit !== undefined) splitText(el, unit);
    else if (preset === 'typewriter') typewriter(el, trigger);
    else if (preset === 'meteors') meteors(el);
  }

  /** Mount one `data-ck-motion` element; whether it counts as mounted. */
  function motion(el: HTMLElement, preset: string): boolean {
    const trigger = el.getAttribute('data-ck-trigger') ?? 'view';
    const once = el.getAttribute('data-ck-once') !== 'false';
    /* Structure first — it is layout, kept under reduced motion and on the canvas. */
    if (preset === 'reading-progress' && el.getAttribute('aria-hidden') === null) setAttr(el, 'aria-hidden', 'true');
    if (preset.startsWith('stagger-')) indexChildren(el, preset === 'stagger-grid', 12);
    else if (preset === 'orbit' || preset === 'sticky-stack') indexChildren(el, false, 999);
    if (preset === 'draw-line') drawLine(el);
    if (preset === 'word-rotate') wordRotate(el);
    if (reduced) return !rebuilds(preset);
    if (still) return !rebuilds(preset);
    rebuild(el, preset, trigger);
    if (trigger === 'view') observeView(el, once);
    else if (trigger === 'click') {
      listen(el, 'click', function clicked() {
        play(targetOf(el));
      });
    } else if (trigger === 'hover') {
      listen(el, 'pointerenter', function entered() {
        play(el);
      });
      listen(el, 'focusin', function focused() {
        play(el);
      });
    }
    return true;
  }

  /*
    The canvas Preview: the panel sets data-ck-play on the canvas DOM. CSS
    presets replay by themselves; the DOM-rebuilding ones are built for the
    preview only and taken down again after it, so the canvas the author
    edits never holds runtime spans for long.
  */
  const previews = new Map<Element, () => void>();
  function stopPreview(el: Element): void {
    const stop = previews.get(el);
    if (stop !== undefined) stop();
  }
  function startPreview(el: HTMLElement, preset: string): void {
    stopPreview(el);
    const start = cleanups.length;
    const hadMark = el.hasAttribute(MARK);
    if (!hadMark) el.setAttribute(MARK, '');
    rebuild(el, preset, 'load');
    const mine = cleanups.splice(start);
    const timer = view.setTimeout(function expire() {
      stopPreview(el);
    }, 6000);
    previews.set(el, function stop() {
      previews.delete(el);
      view.clearTimeout(timer);
      for (let at = mine.length - 1; at >= 0; at -= 1) {
        try {
          mine[at]?.();
        } catch {
          // One failing cleanup must not strand the others.
        }
      }
      if (!hadMark) el.removeAttribute(MARK);
    });
  }

  /* ── mount ─────────────────────────────────────────────────────────────── */

  // media-motion (2026-10-06): the engine markers join, equal to script.ts BEHAVIOR_RUNTIME_SELECTOR.
  const SELECTOR =
    '[data-ck-behavior], [data-ck-motion], [data-ck-hover], .ck-fx-spotlight, [data-ck-scene], [data-ck-timeline], [data-ck-lottie]';
  if (still && (root as Node).nodeType === 1) setAttr(root as Element, 'data-ck-still', '');
  const found: Element[] = [];
  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) {
    found.push(root as Element);
  }
  found.push(...Array.from(root.querySelectorAll(SELECTOR)));
  for (const el of found) {
    if (el.hasAttribute(MARK) || el.hasAttribute('data-ck-clone')) continue;
    if (el.closest('[data-ck-clone]') !== null) continue;
    const behavior = el.getAttribute('data-ck-behavior');
    const html = el as HTMLElement;
    let mounted = true;
    if (behavior === null) mounted = false;
    else if (behavior === 'reveal') reveal(el);
    else if (behavior === 'stagger') stagger(el);
    else if (behavior === 'count-up') countUp(el);
    else if (behavior === 'countdown') countdown(el);
    else if (behavior === 'marquee') marquee(html);
    else if (behavior === 'tabs') tabs(el);
    else if (behavior === 'sticky-header') stickyHeader(el);
    else if (behavior === 'whatsapp-form' && interactive) whatsappForm(el);
    else if (behavior === 'copy-text' && interactive) copyText(el);
    else if (behavior === 'ticker') ticker(html);
    else if (behavior === 'layout') layout(html);
    else mounted = false;
    const preset = el.getAttribute('data-ck-motion');
    if (preset !== null && preset !== '' && motion(html, preset)) mounted = true;
    const hover = el.getAttribute('data-ck-hover');
    if (hover !== null && hover !== '' && hoverPreset(html, hover)) mounted = true;
    if (el.classList.contains('ck-fx-spotlight')) spotlight(html);
    if (mounted) setAttr(el, MARK, reduced ? 'static' : '');
  }

  if (still && !reduced) {
    const Mutation = (view as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (typeof Mutation === 'function') {
      const watcher = new Mutation(function previewed(records: MutationRecord[]) {
        for (const record of records) {
          const el = record.target as HTMLElement;
          const preset = el.getAttribute('data-ck-motion') ?? '';
          if (!rebuilds(preset)) continue;
          if (el.hasAttribute('data-ck-play')) startPreview(el, preset);
          else stopPreview(el);
        }
      });
      watcher.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-ck-play'] });
      cleanups.push(function unwatch() {
        watcher.disconnect();
        for (const stop of Array.from(previews.values())) stop();
      });
    }
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
