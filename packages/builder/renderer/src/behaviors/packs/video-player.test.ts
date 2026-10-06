import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountVideoPlayer } from './video-player';

/* ── stubs: reduced motion, IntersectionObserver, and a media element that "plays" ── */

let reducedMotion = false;
let observed: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];

class StubObserver {
  readonly entry: { callback: IntersectionObserverCallback; targets: Element[] };
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: [] };
    observed.push(this.entry);
  }
  observe(target: Element): void {
    this.entry.targets.push(target);
  }
  disconnect(): void {
    this.entry.targets = [];
  }
  unobserve(): void {
    // The stub observes until disconnect.
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function leaveAll(): void {
  for (const entry of observed) {
    const records = entry.targets.map(
      (target) => ({ isIntersecting: false, target }) as unknown as IntersectionObserverEntry,
    );
    if (records.length > 0) entry.callback(records, {} as IntersectionObserver);
  }
}

interface FakeMedia {
  paused: boolean;
  time: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

/** Give one video a working paused / currentTime / duration and spied play / pause. */
function fake(video: HTMLVideoElement, duration = 90): FakeMedia {
  const media: FakeMedia = {
    paused: true,
    time: 0,
    play: vi.fn(() => {
      media.paused = false;
      video.dispatchEvent(new Event('play'));
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      media.paused = true;
      video.dispatchEvent(new Event('pause'));
    }),
  };
  Object.defineProperty(video, 'paused', { configurable: true, get: () => media.paused });
  Object.defineProperty(video, 'ended', { configurable: true, get: () => false });
  Object.defineProperty(video, 'duration', { configurable: true, get: () => duration });
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => media.time,
    set: (value: number) => {
      media.time = value;
    },
  });
  Object.defineProperty(video, 'play', { configurable: true, value: media.play });
  Object.defineProperty(video, 'pause', { configurable: true, value: media.pause });
  return media;
}

const FIGURE = `<figure data-ck-behavior="video-player" class="relative aspect-video">
  <video controls playsinline preload="metadata" poster="https://images.example/p.jpg">
    <source src="https://media.example/clip.mp4" type="video/mp4">
    <track kind="captions" src="https://media.example/ar.vtt" srclang="ar" label="العربية">
  </video>
  <figcaption>عنوان</figcaption>
</figure>`;

function stage(html: string, lang = 'en', dir = 'ltr'): { host: HTMLElement; video: HTMLVideoElement } {
  const host = document.createElement('main');
  host.setAttribute('lang', lang);
  host.setAttribute('dir', dir);
  host.innerHTML = html;
  document.body.appendChild(host);
  const video = host.querySelector('video');
  if (video === null) throw new Error('fixture has no video');
  return { host, video };
}

function key(target: Element, value: string, code = ''): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, code, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  reducedMotion = false;
  observed = [];
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduce') && reducedMotion,
        media: query,
        addEventListener() {
          // The preference never changes in a test.
        },
        removeEventListener() {
          // Nothing was added.
        },
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal('IntersectionObserver', StubObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('mountVideoPlayer', () => {
  it('draws the chrome, drops native controls while mounted, and dispose restores the DOM exactly', () => {
    const { host, video } = stage(FIGURE);
    fake(video);
    const before = host.innerHTML;
    const dispose = mountVideoPlayer(host);
    const figure = host.querySelector('figure');
    expect(video.hasAttribute('controls')).toBe(false);
    expect(figure?.querySelector('.ck-vp .ck-vp-big')).not.toBeNull();
    expect(figure?.querySelector('.ck-vp-bar input[type="range"]')).not.toBeNull();
    expect(figure?.querySelector('.ck-vp-cc')).not.toBeNull();
    expect(figure?.getAttribute('tabindex')).toBe('0');
    dispose();
    expect(host.innerHTML).toBe(before);
    expect(video.hasAttribute('controls')).toBe(true);
  });

  it('is idempotent: a second mount adds nothing, and either disposer is safe', () => {
    const { host, video } = stage(FIGURE);
    fake(video);
    const before = host.innerHTML;
    const first = mountVideoPlayer(host);
    const second = mountVideoPlayer(host);
    expect(host.querySelectorAll('.ck-vp')).toHaveLength(1);
    second();
    expect(host.querySelectorAll('.ck-vp')).toHaveLength(1);
    first();
    first();
    expect(host.innerHTML).toBe(before);
  });

  it('labels in English and plays, pauses, mutes and seeks from the bar', () => {
    const { host, video } = stage(FIGURE);
    const media = fake(video);
    mountVideoPlayer(host);
    const play = host.querySelector<HTMLButtonElement>('.ck-vp-play');
    const mute = host.querySelector<HTMLButtonElement>('.ck-vp-mute');
    const seek = host.querySelector<HTMLInputElement>('.ck-vp-seek');
    expect(play?.getAttribute('aria-label')).toBe('Play');
    expect(seek?.getAttribute('aria-label')).toBe('Seek');
    expect(host.querySelector('.ck-vp-time')?.getAttribute('aria-label')).toBe('Time');
    play?.click();
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(play?.getAttribute('aria-label')).toBe('Pause');
    expect(host.querySelector('.ck-vp')?.classList.contains('ck-playing')).toBe(true);
    play?.click();
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(mute?.getAttribute('aria-label')).toBe('Mute');
    mute?.click();
    video.dispatchEvent(new Event('volumechange'));
    expect(video.muted).toBe(true);
    expect(mute?.getAttribute('aria-label')).toBe('Unmute');
    if (seek !== null) {
      seek.value = '500';
      seek.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(media.time).toBe(45);
  });

  it('labels in Arabic and writes the time in Arabic-Indic digits', () => {
    const { host, video } = stage(FIGURE, 'ar', 'rtl');
    const media = fake(video);
    media.time = 12;
    mountVideoPlayer(host);
    expect(host.querySelector('.ck-vp-play')?.getAttribute('aria-label')).toBe('تشغيل');
    expect(host.querySelector('.ck-vp-mute')?.getAttribute('aria-label')).toBe('كتم الصوت');
    expect(host.querySelector('.ck-vp-cc')?.getAttribute('aria-label')).toBe('الترجمة');
    expect(host.querySelector('.ck-vp-seek')?.getAttribute('aria-label')).toBe('تقديم');
    expect(host.querySelector('.ck-vp-time')?.getAttribute('aria-label')).toBe('الوقت');
    expect(host.querySelector('.ck-vp-time')?.textContent).toBe('٠:١٢ / ١:٣٠');
    expect(host.querySelector('.ck-vp-seek')?.getAttribute('aria-valuetext')).toBe('٠:١٢ / ١:٣٠');
  });

  it('mirrors the seek keys under RTL and reads letter keys by code', () => {
    const rtl = stage(FIGURE, 'ar', 'rtl');
    const rtlMedia = fake(rtl.video);
    rtlMedia.time = 30;
    mountVideoPlayer(rtl.host);
    const rtlFigure = rtl.host.querySelector('figure');
    if (rtlFigure === null) throw new Error('no figure');
    expect(key(rtlFigure, 'ArrowRight').defaultPrevented).toBe(true);
    expect(rtlMedia.time).toBe(25);
    key(rtlFigure, 'ArrowLeft');
    expect(rtlMedia.time).toBe(30);
    // An Arabic layout types «ن» on the K key: the code still plays.
    key(rtlFigure, 'ن', 'KeyK');
    expect(rtlMedia.play).toHaveBeenCalledTimes(1);

    const ltr = stage(FIGURE);
    const ltrMedia = fake(ltr.video);
    ltrMedia.time = 30;
    mountVideoPlayer(ltr.host);
    const ltrFigure = ltr.host.querySelector('figure');
    if (ltrFigure === null) throw new Error('no figure');
    key(ltrFigure, 'ArrowRight');
    expect(ltrMedia.time).toBe(35);
    key(ltrFigure, 'm');
    expect(ltr.video.muted).toBe(true);
    const cc = ltr.host.querySelector('.ck-vp-cc');
    expect(cc?.getAttribute('aria-pressed')).toBe('false');
    key(ltrFigure, 'c');
    expect(cc?.getAttribute('aria-pressed')).toBe('true');
  });

  it('pauses when the player leaves the viewport', () => {
    const { host, video } = stage(FIGURE);
    const media = fake(video);
    mountVideoPlayer(host);
    host.querySelector<HTMLButtonElement>('.ck-vp-big')?.click();
    expect(media.paused).toBe(false);
    leaveAll();
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(media.paused).toBe(true);
  });

  it('draws the chrome inert on the canvas and never plays there', () => {
    const { host, video } = stage(FIGURE.replace('<video ', '<video autoplay '));
    const media = fake(video);
    const before = host.innerHTML;
    const dispose = mountVideoPlayer(host, { interactive: false });
    const chrome = host.querySelector<HTMLElement>('.ck-vp');
    expect(chrome?.hasAttribute('inert')).toBe(true);
    expect(chrome?.style.pointerEvents).toBe('none');
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(host.querySelector('figure')?.hasAttribute('tabindex')).toBe(false);
    host.querySelector<HTMLButtonElement>('.ck-vp-big')?.click();
    video.click();
    expect(media.play).not.toHaveBeenCalled();
    dispose();
    expect(host.innerHTML).toBe(before);
  });

  it('forces nothing under reduced motion: an authored autoplay is dropped', () => {
    reducedMotion = true;
    const { host, video } = stage(FIGURE.replace('<video ', '<video autoplay '));
    const media = fake(video);
    mountVideoPlayer(host);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(media.play).not.toHaveBeenCalled();
    expect(media.pause).toHaveBeenCalled();
  });

  it('draws no captions button without a track', () => {
    const { host, video } = stage(FIGURE.replace(/<track[^>]*>/u, ''));
    fake(video);
    mountVideoPlayer(host);
    expect(host.querySelector('.ck-vp-cc')).toBeNull();
  });

  it('is self-contained: its serialised form mounts in a fresh document', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument;
    if (fresh === null) throw new Error('no frame document');
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.documentElement.setAttribute('dir', 'rtl');
    fresh.body.innerHTML = FIGURE;
    const script = `(${mountVideoPlayer.toString()})(document);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', script)(fresh);
    expect(fresh.querySelector('figure')?.hasAttribute('data-ck-player')).toBe(true);
    expect(fresh.querySelector('.ck-vp-play')?.getAttribute('aria-label')).toBe('تشغيل');
    frame.remove();
  });

  it('stays within its size budget: at most 3.5 kB gzip serialised', () => {
    expect(gzipSync(mountVideoPlayer.toString()).length).toBeLessThanOrEqual(3584);
  });
});
