import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountBgVideo } from './bg-video';

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

function intersect(isIntersecting: boolean): void {
  for (const entry of observed) {
    const records = entry.targets.map(
      (target) => ({ isIntersecting, target }) as unknown as IntersectionObserverEntry,
    );
    if (records.length > 0) entry.callback(records, {} as IntersectionObserver);
  }
}

function spies(video: HTMLVideoElement): { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  Object.defineProperty(video, 'play', { configurable: true, value: play });
  Object.defineProperty(video, 'pause', { configurable: true, value: pause });
  return { play, pause };
}

const SECTION = `<section data-ck-behavior="bg-video" class="relative isolate">
  <video muted loop playsinline preload="metadata" poster="https://images.example/p.jpg" aria-hidden="true" class="absolute inset-0 -z-10">
    <source src="https://media.example/loop.mp4" type="video/mp4">
  </video>
  <h1>مطعم الياسمين</h1>
</section>`;

function stage(lang = 'ar', html = SECTION): { host: HTMLElement; video: HTMLVideoElement } {
  const host = document.createElement('main');
  host.setAttribute('lang', lang);
  host.innerHTML = html;
  document.body.appendChild(host);
  const video = host.querySelector('video');
  if (video === null) throw new Error('fixture has no video');
  return { host, video };
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

describe('mountBgVideo', () => {
  it('plays only in view, pauses out of view, and offers an Arabic pause toggle', () => {
    const { host, video } = stage();
    const media = spies(video);
    mountBgVideo(host);
    expect(media.play).not.toHaveBeenCalled();
    intersect(true);
    expect(media.play).toHaveBeenCalledTimes(1);
    intersect(false);
    expect(media.pause).toHaveBeenCalled();
    intersect(true);
    const toggle = host.querySelector<HTMLButtonElement>('section > .ck-bgv-toggle');
    expect(toggle?.getAttribute('aria-label')).toBe('إيقاف الخلفية');
    const plays = media.play.mock.calls.length;
    toggle?.click();
    expect(toggle?.getAttribute('aria-label')).toBe('تشغيل الخلفية');
    expect(toggle?.classList.contains('ck-paused')).toBe(true);
    intersect(true);
    expect(media.play.mock.calls.length).toBe(plays);
    toggle?.click();
    expect(media.play.mock.calls.length).toBe(plays + 1);
  });

  it('labels the toggle in English on an English page', () => {
    const { host, video } = stage('en');
    spies(video);
    mountBgVideo(host);
    const toggle = host.querySelector<HTMLButtonElement>('.ck-bgv-toggle');
    expect(toggle?.getAttribute('aria-label')).toBe('Pause background');
    toggle?.click();
    expect(toggle?.getAttribute('aria-label')).toBe('Play background');
  });

  it('never plays and draws no button under reduced motion', () => {
    reducedMotion = true;
    const { host, video } = stage('ar', SECTION.replace('<video ', '<video autoplay '));
    const media = spies(video);
    mountBgVideo(host);
    intersect(true);
    expect(media.play).not.toHaveBeenCalled();
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(host.querySelector('.ck-bgv-toggle')).toBeNull();
    expect(host.querySelector('section')?.getAttribute('data-ck-bg-video')).toBe('static');
  });

  it('never plays and draws no button on the canvas', () => {
    const { host, video } = stage();
    const media = spies(video);
    mountBgVideo(host, { interactive: false });
    intersect(true);
    expect(media.play).not.toHaveBeenCalled();
    expect(host.querySelector('.ck-bgv-toggle')).toBeNull();
  });

  it('restores the DOM exactly on dispose and is idempotent', () => {
    const { host, video } = stage('ar', SECTION.replace('<video ', '<video autoplay '));
    spies(video);
    const before = host.innerHTML;
    const first = mountBgVideo(host);
    const second = mountBgVideo(host);
    expect(host.querySelectorAll('.ck-bgv-toggle')).toHaveLength(1);
    second();
    first();
    first();
    expect(host.innerHTML).toBe(before);
  });

  it('is self-contained: its serialised form mounts in a fresh document', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument;
    if (fresh === null) throw new Error('no frame document');
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.body.innerHTML = SECTION;
    const video = fresh.querySelector('video');
    if (video !== null) spies(video);
    const script = `(${mountBgVideo.toString()})(document);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', script)(fresh);
    expect(fresh.querySelector('section')?.hasAttribute('data-ck-bg-video')).toBe(true);
    expect(fresh.querySelector('.ck-bgv-toggle')?.getAttribute('aria-label')).toBe('إيقاف الخلفية');
    frame.remove();
  });

  it('stays within its size budget: at most 3.5 kB gzip serialised', () => {
    expect(gzipSync(mountBgVideo.toString()).length).toBeLessThanOrEqual(3584);
  });
});
