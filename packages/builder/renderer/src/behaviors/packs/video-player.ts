/**
 * The `video-player` behaviour pack (media-motion DESIGN §A.2): our own chrome
 * over a native `<video>` inside `[data-ck-behavior="video-player"]` (a figure
 * or a div).
 *
 * - While mounted, the native `controls` attribute is removed; dispose puts it
 *   back, so without the script the reader still gets the browser's player.
 * - The chrome: a centred big play button and a control bar with play/pause, a
 *   native `input[type=range]` scrubber (keyboard and RTL for free; it is not
 *   flipped twice), the time (Arabic-Indic digits under `lang=ar`), mute, a
 *   captions toggle when a `<track>` exists, picture-in-picture when the
 *   document supports it, and fullscreen on the wrapper.
 * - Keys while focus is inside the wrapper: Space/K play, ←/→ seek 5 s
 *   (swapped under RTL), M mute, F fullscreen, C captions. Letter keys are read
 *   from `event.code` too, so an Arabic keyboard layout works.
 * - It pauses when the wrapper leaves the viewport and when the tab hides.
 * - On the editing canvas (`interactive: false`) the chrome is drawn but
 *   inert (`inert` + `pointer-events: none`, so a click selects) and the video
 *   never plays. Reduced motion forces nothing: an authored `autoplay` is
 *   dropped, and the reader presses play.
 *
 * Serialised with `Function.prototype.toString` into the published site's
 * behaviour script, so this function has NO imports and reads NO module-scope
 * identifier; every helper lives inside it. The styles are `VIDEO_PACK_CSS`.
 */
export function mountVideoPlayer(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const noop = (): void => {
    // ignore
  };
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null) return noop;
  const view: Window = win;
  const page: Document = doc;
  const interactive = options?.interactive !== false;
  const MARK = 'data-ck-player';
  const reduced =
    typeof view.matchMedia === 'function' && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups: (() => void)[] = [];
  const saved: { el: Element; name: string; original: string | null; applied: string | null; order: string[] }[] =
    [];
  function setAttr(el: Element, name: string, value: string | null): void {
    let entry = saved.find((item) => item.el === el && item.name === name);
    if (entry === undefined) {
      entry = { el, name, original: el.getAttribute(name), applied: null, order: el.getAttributeNames() };
      saved.push(entry);
    }
    entry.applied = value;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
  function listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    cleanups.push(() => {
      target.removeEventListener(type, handler);
    });
  }
  function isRtl(el: Element): boolean {
    try {
      if (view.getComputedStyle(el).direction === 'rtl') return true;
    } catch {
      // ignore
    }
    return ((el.closest('[dir]') ?? page.documentElement).getAttribute('dir') ?? '').toLowerCase() === 'rtl';
  }
  function quiet(run: () => unknown, then = noop): void {
    try {
      const pending = run() as Promise<unknown> | undefined;
      if (typeof pending?.then === 'function') void pending.then(then, then);
    } catch {
      // ignore
    }
  }

  function player(el: HTMLElement, video: HTMLVideoElement): void {
    const written = el.closest('[lang]')?.getAttribute('lang') ?? '';
    const chosen = written !== '' ? written : page.documentElement.lang;
    const ar = /^ar(?:-|$)/iu.test(chosen);
    const lang = ar && !/-u-|^ar-(?:MA|DZ|TN|LY|EH)\b/iu.test(chosen) ? `${chosen}-u-nu-arab` : chosen;
    const [tPlay, tPause, tMute, tUnmute, tFull, tCc, tPip, tSeek, tTime] = (
      ar
        ? 'تشغيل|إيقاف مؤقت|كتم الصوت|إلغاء الكتم|ملء الشاشة|الترجمة|صورة داخل صورة|تقديم|الوقت'
        : 'Play|Pause|Mute|Unmute|Full screen|Captions|Picture in picture|Seek|Time'
    ).split('|') as [string, string, string, string, string, string, string, string, string];
    function digits(value: number, pad: number): string {
      try {
        return new Intl.NumberFormat(lang === '' ? undefined : lang, {
          minimumIntegerDigits: pad,
          useGrouping: false,
        }).format(value);
      } catch {
        return String(value).padStart(pad, '0');
      }
    }
    function clock(seconds: number): string {
      const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      return `${hours > 0 ? `${digits(hours, 1)}:${digits(minutes, 2)}` : digits(minutes, 1)}:${digits(total % 60, 2)}`;
    }
    function make<K extends keyof HTMLElementTagNameMap>(tag: K, name: string, label?: string): HTMLElementTagNameMap[K] {
      const made = page.createElement(tag);
      made.className = name;
      if (label !== undefined) made.setAttribute('aria-label', label);
      return made;
    }
    function button(name: string, label?: string): HTMLButtonElement {
      const made = make('button', `ck-vp-btn ${name}`, label);
      made.type = 'button';
      return made;
    }
    const halt = (): void => {
      quiet(() => {
        video.pause();
      });
    };
    const toggle = (): void => {
      if (video.paused || video.ended) quiet(() => video.play());
      else halt();
    };

    setAttr(el, MARK, interactive ? '' : 'still');
    if (video.hasAttribute('controls')) setAttr(video, 'controls', null);
    if ((!interactive || reduced) && video.hasAttribute('autoplay')) {
      setAttr(video, 'autoplay', null);
      halt();
    }
    if (interactive && !el.hasAttribute('tabindex')) setAttr(el, 'tabindex', '0');

    const ui = make('div', 'ck-vp');
    if (!interactive) {
      ui.setAttribute('inert', '');
      ui.style.pointerEvents = 'none';
    }
    const big = button('ck-vp-big');
    const bar = make('div', 'ck-vp-bar');
    const play = button('ck-vp-play');
    const seek = make('input', 'ck-vp-seek', tSeek);
    seek.type = 'range';
    seek.max = '1000';
    seek.value = '0';
    const time = make('span', 'ck-vp-time', tTime);
    time.setAttribute('role', 'timer');
    const mute = button('ck-vp-mute');
    bar.append(play, seek, time, mute);

    const tracks = Array.from((video as { textTracks?: TextTrackList }).textTracks ?? []).filter(
      (track) => track.kind === 'captions' || track.kind === 'subtitles',
    );
    const modes = tracks.map((track) => track.mode);
    let captions = tracks.some((track) => track.mode === 'showing') || video.querySelector('track[default]') !== null;
    const cc = video.querySelector('track') === null ? null : button('ck-vp-cc', tCc);
    function setCaptions(on: boolean): void {
      captions = on;
      tracks.forEach((track, at) => {
        track.mode = on && at === 0 ? 'showing' : 'hidden';
      });
      render();
    }
    const pip =
      page.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function'
        ? button('ck-vp-pip', tPip)
        : null;
    const webkit = (video as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen;
    const full =
      typeof el.requestFullscreen === 'function' || typeof webkit === 'function' ? button('ck-vp-full', tFull) : null;
    for (const extra of [cc, pip, full]) if (extra !== null) bar.append(extra);
    ui.append(big, bar);
    el.appendChild(ui);
    cleanups.push(() => {
      ui.remove();
      tracks.forEach((track, at) => {
        track.mode = modes[at] ?? track.mode;
      });
    });

    function render(): void {
      const paused = video.paused || video.ended;
      const muted = video.muted || video.volume === 0;
      const length = video.duration;
      const share = Number.isFinite(length) && length > 0 ? Math.min(1, video.currentTime / length) : 0;
      const shown = `${clock(video.currentTime)} / ${clock(length)}`;
      ui.classList.toggle('ck-playing', !paused);
      ui.classList.toggle('ck-muted', muted);
      big.setAttribute('aria-label', paused ? tPlay : tPause);
      play.setAttribute('aria-label', paused ? tPlay : tPause);
      mute.setAttribute('aria-label', muted ? tUnmute : tMute);
      time.textContent = shown;
      seek.value = String(Math.round(share * 1000));
      seek.setAttribute('aria-valuetext', shown);
      seek.style.setProperty('--ck-vp-p', `${(share * 100).toFixed(2)}%`);
      cc?.setAttribute('aria-pressed', String(captions));
      pip?.setAttribute('aria-pressed', String(page.pictureInPictureElement === video));
      full?.setAttribute('aria-pressed', String(page.fullscreenElement === el));
    }
    for (const type of ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange'])
      listen(video, type, render);
    listen(page, 'fullscreenchange', render);
    render();
    if (!interactive) return;

    function fullscreen(): void {
      if (page.fullscreenElement === el) quiet(() => page.exitFullscreen());
      else if (typeof el.requestFullscreen === 'function') quiet(() => el.requestFullscreen());
      else webkit?.call(video);
    }
    const flipMute = (): void => {
      video.muted = !video.muted;
    };
    for (const control of [big, play, video]) listen(control, 'click', toggle);
    listen(mute, 'click', flipMute);
    listen(seek, 'input', () => {
      const length = video.duration;
      if (Number.isFinite(length) && length > 0) video.currentTime = (Number(seek.value) / 1000) * length;
    });
    if (cc !== null) {
      listen(cc, 'click', () => {
        setCaptions(!captions);
      });
    }
    if (pip !== null) {
      listen(pip, 'click', () => {
        quiet(
          () => (page.pictureInPictureElement === video ? page.exitPictureInPicture() : video.requestPictureInPicture()),
          render,
        );
      });
    }
    if (full !== null) listen(full, 'click', fullscreen);
    listen(el, 'keydown', (event) => {
      const pressed = event as KeyboardEvent;
      if (pressed.ctrlKey || pressed.metaKey || pressed.altKey) return;
      const target = pressed.target as Element | null;
      const key = /^Key[KMFC]$/u.test(pressed.code) ? pressed.code.slice(3).toLowerCase() : pressed.key.toLowerCase();
      if (key === 'k' || (key === ' ' && target?.tagName !== 'BUTTON')) toggle();
      else if ((key === 'arrowleft' || key === 'arrowright') && target !== seek) {
        const length = video.duration;
        const next = Math.max(0, video.currentTime + ((key === 'arrowright') !== isRtl(el) ? 5 : -5));
        video.currentTime = Number.isFinite(length) ? Math.min(length, next) : next;
      } else if (key === 'm') flipMute();
      else if (key === 'f' && full !== null) fullscreen();
      else if (key === 'c' && cc !== null) setCaptions(!captions);
      else return;
      pressed.preventDefault();
    });

    const away = (): void => {
      if (!video.paused && page.pictureInPictureElement !== video) halt();
    };
    const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    if (typeof Observer === 'function') {
      const observer = new Observer(
        (entries) => {
          if (entries.some((entry) => !entry.isIntersecting)) away();
        },
        { threshold: 0 },
      );
      observer.observe(el);
      cleanups.push(() => {
        observer.disconnect();
      });
    }
    listen(page, 'visibilitychange', () => {
      if (page.visibilityState === 'hidden') away();
    });
  }

  const SELECTOR = '[data-ck-behavior="video-player"]';
  const self = (root as Node).nodeType === 1 && (root as Element).matches(SELECTOR) ? [root as Element] : [];
  for (const el of [...self, ...Array.from(root.querySelectorAll(SELECTOR))]) {
    const video = el.hasAttribute(MARK) || el.tagName === 'VIDEO' ? null : el.querySelector('video');
    if (video !== null) player(el as HTMLElement, video);
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.reverse()) quiet(cleanup);
    cleanups.length = 0;
    for (const item of saved.reverse()) {
      const { el, name, original, order } = item;
      if (el.getAttribute(name) !== item.applied) continue;
      const missing = !el.hasAttribute(name);
      if (original === null) el.removeAttribute(name);
      else el.setAttribute(name, original);
      if (!missing || original === null) continue;
      for (const after of order.slice(order.indexOf(name) + 1)) {
        const value = el.getAttribute(after);
        if (value === null) continue;
        el.removeAttribute(after);
        el.setAttribute(after, value);
      }
    }
    saved.length = 0;
  };
}
