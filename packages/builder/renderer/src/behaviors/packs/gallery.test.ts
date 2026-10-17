import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountGallery } from './gallery';
import { GALLERY_PACK_CSS } from './gallery-css';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener() {
          // The preference never changes in a test.
        },
        removeEventListener() {
          // Nothing was added.
        },
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

function dialog(): HTMLDialogElement | null {
  return document.querySelector('dialog[data-ck-lightbox]');
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

function pointer(target: Element, type: string, clientX: number, pointerType = 'touch'): void {
  const event = new MouseEvent(type, { clientX, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  target.dispatchEvent(event);
}

const THREE = [
  '<div data-ck-behavior="gallery">',
  '<figure><img src="/a.webp" alt="القهوة" /><figcaption>فنجان الصباح</figcaption></figure>',
  '<figure><img src="/b.webp" alt="الكعك" /></figure>',
  '<figure><img src="/c.webp" alt="" /></figure>',
  '</div>',
].join('');

describe('mountGallery — the single-image lightbox (ported from runtime.ts)', () => {
  it('opens a lightbox dialog with the image, its alt as the label, and a close button', () => {
    const host = mount('<figure data-ck-behavior="lightbox"><img src="/a.webp" alt="القهوة" /></figure>');
    const dispose = mountGallery(host);
    host.querySelector('figure')!.click();
    const box = dialog();
    expect(box?.getAttribute('aria-label')).toBe('القهوة');
    expect(box?.querySelector('img')?.getAttribute('src')).toMatch(/\/a\.webp$/u);
    // The old markup exactly: one image and one close button, no group chrome.
    expect(box?.querySelectorAll('button')).toHaveLength(1);
    expect(box?.querySelector('[data-ck-lightbox-counter]')).toBeNull();
    expect(box?.querySelector('[data-ck-lightbox-caption]')).toBeNull();
    dispose();
    expect(dialog()).toBeNull();
  });

  it('labels the close button in the page language and returns focus to the element', () => {
    const host = mount(
      '<div lang="ar"><figure data-ck-behavior="lightbox"><img src="/a.webp" alt="" /></figure></div>',
    );
    mountGallery(host);
    const figure = host.querySelector('figure')!;
    expect(figure.getAttribute('tabindex')).toBe('0');
    expect(figure.getAttribute('role')).toBe('button');
    expect(figure.getAttribute('aria-haspopup')).toBe('dialog');
    key(figure, 'Enter');
    const close = dialog()?.querySelector('button');
    expect(close?.getAttribute('aria-label')).toBe('إغلاق');
    expect(dialog()?.getAttribute('aria-label')).toBe('صورة');
    expect(document.activeElement).toBe(close);
    close?.click();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(figure);
  });

  it('leaves a button or link opener its own role and focus order', () => {
    const host = mount('<button data-ck-behavior="lightbox"><img src="/a.webp" alt="a" /></button>');
    mountGallery(host);
    const button = host.querySelector('button')!;
    expect(button.hasAttribute('role')).toBe(false);
    expect(button.hasAttribute('tabindex')).toBe(false);
    button.click();
    expect(dialog()).not.toBeNull();
  });

  it('shows a single figure caption when the figure has one', () => {
    const host = mount(
      '<figure data-ck-behavior="lightbox"><img src="/a.webp" alt="a" /><figcaption>Morning cup</figcaption></figure>',
    );
    mountGallery(host);
    host.querySelector('figure')!.click();
    expect(dialog()?.querySelector('[data-ck-lightbox-caption]')?.textContent).toBe('Morning cup');
  });
});

describe('mountGallery — a gallery of many', () => {
  it('makes every thumbnail a button and opens ONE shared dialog at that index', () => {
    const host = mount(`<div lang="en">${THREE}</div>`);
    mountGallery(host);
    const images = [...host.querySelectorAll('img')];
    for (const image of images) {
      expect(image.getAttribute('tabindex')).toBe('0');
      expect(image.getAttribute('role')).toBe('button');
      expect(image.getAttribute('aria-haspopup')).toBe('dialog');
    }
    // An image without alt still gets an accessible name.
    expect(images[2]?.getAttribute('aria-label')).toBe('Open image 3');
    images[1]?.click();
    expect(document.querySelectorAll('dialog[data-ck-lightbox]')).toHaveLength(1);
    const box = dialog()!;
    expect(box.querySelector('img')?.getAttribute('src')).toMatch(/\/b\.webp$/u);
    expect(box.querySelector('[data-ck-lightbox-counter]')?.textContent).toBe('2 / 3');
    expect(box.querySelector('[data-ck-lightbox-counter]')?.getAttribute('aria-live')).toBe('polite');
    // No figcaption: the caption falls back to the alt text.
    expect(box.querySelector('[data-ck-lightbox-caption]')?.textContent).toBe('الكعك');
    const labels = [...box.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['Previous', 'Next', 'Close']);
  });

  it('walks the group with prev/next (wrapping), Home and End; the caption follows the figure', () => {
    const host = mount(`<div lang="en">${THREE}</div>`);
    mountGallery(host);
    host.querySelector<HTMLElement>('img')!.click();
    const box = dialog()!;
    const src = () => box.querySelector('img')?.getAttribute('src') ?? '';
    expect(box.querySelector('[data-ck-lightbox-caption]')?.textContent).toBe('فنجان الصباح');
    box.querySelector<HTMLElement>('[data-ck-lightbox-nav="next"]')!.click();
    expect(src()).toMatch(/b\.webp$/u);
    // A nav click does not bubble into the dialog's click-to-close.
    expect(dialog()).not.toBeNull();
    box.querySelector<HTMLElement>('[data-ck-lightbox-nav="prev"]')!.click();
    box.querySelector<HTMLElement>('[data-ck-lightbox-nav="prev"]')!.click();
    expect(src()).toMatch(/c\.webp$/u);
    expect(box.querySelector('[data-ck-lightbox-caption]')?.hasAttribute('hidden')).toBe(true);
    key(box, 'Home');
    expect(src()).toMatch(/a\.webp$/u);
    key(box, 'End');
    expect(src()).toMatch(/c\.webp$/u);
  });

  it('steps with the arrow keys in LTR, and swaps them in RTL', () => {
    const ltr = mount(`<div dir="ltr" lang="en">${THREE}</div>`);
    mountGallery(ltr);
    ltr.querySelector<HTMLElement>('img')!.click();
    key(dialog()!, 'ArrowRight');
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toMatch(/b\.webp$/u);
    dialog()?.querySelector<HTMLElement>('button:last-of-type')?.click();
    document.body.innerHTML = '';

    const rtl = mount(`<div dir="rtl" lang="ar">${THREE}</div>`);
    mountGallery(rtl);
    rtl.querySelector<HTMLElement>('img')!.click();
    expect(dialog()?.getAttribute('dir')).toBe('rtl');
    key(dialog()!, 'ArrowLeft');
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toMatch(/b\.webp$/u);
    key(dialog()!, 'ArrowRight');
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toMatch(/a\.webp$/u);
  });

  it('counts in Arabic-Indic digits and labels the controls in Arabic under lang=ar', () => {
    const host = mount(`<div lang="ar" dir="rtl">${THREE}</div>`);
    mountGallery(host);
    host.querySelectorAll<HTMLElement>('img')[2]!.click();
    const box = dialog()!;
    expect(box.querySelector('[data-ck-lightbox-counter]')?.textContent).toBe('٣ / ٣');
    const labels = [...box.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['السابق', 'التالي', 'إغلاق']);
    expect(host.querySelectorAll('img')[2]?.getAttribute('aria-label')).toBe('فتح الصورة ٣');
  });

  it('swipes 40px or more on touch, mirrored in RTL, and the swipe does not close the dialog', () => {
    const host = mount(`<div dir="ltr" lang="en">${THREE}</div>`);
    mountGallery(host);
    host.querySelector<HTMLElement>('img')!.click();
    const box = dialog()!;
    pointer(box, 'pointerdown', 200);
    pointer(box, 'pointerup', 170);
    // Under the threshold: nothing moves.
    expect(box.querySelector('img')?.getAttribute('src')).toMatch(/a\.webp$/u);
    pointer(box, 'pointerdown', 200);
    pointer(box, 'pointerup', 120);
    box.click();
    expect(dialog()).not.toBeNull();
    expect(box.querySelector('img')?.getAttribute('src')).toMatch(/b\.webp$/u);
    // A mouse drag is not a swipe.
    pointer(box, 'pointerdown', 200, 'mouse');
    pointer(box, 'pointerup', 50, 'mouse');
    expect(box.querySelector('img')?.getAttribute('src')).toMatch(/b\.webp$/u);
    box.querySelector<HTMLElement>('button:last-of-type')?.click();

    document.body.innerHTML = '';
    const rtl = mount(`<div dir="rtl" lang="ar">${THREE}</div>`);
    mountGallery(rtl);
    rtl.querySelector<HTMLElement>('img')!.click();
    pointer(dialog()!, 'pointerdown', 100);
    pointer(dialog()!, 'pointerup', 180);
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toMatch(/b\.webp$/u);
  });

  it('preloads the next and previous images', () => {
    const set = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
    const host = mount(`<div lang="en">${THREE}</div>`);
    mountGallery(host);
    host.querySelectorAll<HTMLElement>('img')[1]!.click();
    // The shown image, then its two neighbours.
    const sources = set.mock.calls.map(([value]) => value);
    expect(sources).toHaveLength(3);
    expect(sources[0]).toMatch(/b\.webp$/u);
    expect(sources.slice(1).sort()).toEqual([
      expect.stringMatching(/a\.webp$/u),
      expect.stringMatching(/c\.webp$/u),
    ]);
  });

  it('returns focus to the thumbnail that opened it, on close and on Escape', () => {
    const host = mount(`<div lang="en">${THREE}</div>`);
    mountGallery(host);
    const second = host.querySelectorAll('img')[1]!;
    key(second, ' ');
    const box = dialog()!;
    box.querySelector<HTMLElement>('[data-ck-lightbox-nav="next"]')!.click();
    box.dispatchEvent(new Event('close'));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(second);
  });

  it('uses a wrapping link as the opener and stops its navigation', () => {
    const host = mount(
      '<div data-ck-behavior="gallery"><a href="/full-a.webp"><img src="/a.webp" alt="a" /></a><a href="/full-b.webp"><img src="/b.webp" alt="b" /></a></div>',
    );
    mountGallery(host);
    const link = host.querySelector('a')!;
    expect(link.getAttribute('aria-haspopup')).toBe('dialog');
    expect(host.querySelector('img')?.hasAttribute('role')).toBe(false);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  it('skips marquee clones and images of a nested gallery', () => {
    const host = mount(
      [
        '<div data-ck-behavior="gallery">',
        '<img src="/a.webp" alt="a" />',
        '<div data-ck-clone=""><img src="/a.webp" alt="a" /></div>',
        '<div data-ck-behavior="lightbox"><img src="/z.webp" alt="z" /></div>',
        '<img src="/b.webp" alt="b" />',
        '</div>',
      ].join(''),
    );
    mountGallery(host);
    host.querySelector<HTMLElement>('img')!.click();
    expect(dialog()?.querySelector('[data-ck-lightbox-counter]')?.textContent).toBe('1 / 2');
    expect(host.querySelector('[data-ck-clone] img')?.hasAttribute('role')).toBe(false);
  });
});

describe('mountGallery — canvas, idempotence, dispose, serialisation', () => {
  it('attaches nothing on the editing canvas', () => {
    const host = mount(`${THREE}<figure data-ck-behavior="lightbox"><img src="/x.webp" alt="x" /></figure>`);
    const dispose = mountGallery(host, { interactive: false });
    for (const image of host.querySelectorAll('img')) {
      expect(image.hasAttribute('role')).toBe(false);
      expect(image.hasAttribute('tabindex')).toBe(false);
      (image as HTMLElement).click();
    }
    expect(dialog()).toBeNull();
    expect(host.querySelectorAll('[data-ck-mounted]')).toHaveLength(0);
    dispose();
  });

  it('is idempotent: a second mount adds no second listener', () => {
    const host = mount(`<div lang="en">${THREE}</div>`);
    mountGallery(host);
    const again = mountGallery(host);
    host.querySelector<HTMLElement>('img')!.click();
    expect(document.querySelectorAll('dialog[data-ck-lightbox]')).toHaveLength(1);
    again();
    expect(host.querySelector('img')?.getAttribute('role')).toBe('button');
  });

  it('the disposer removes the dialog and listeners and restores the DOM', () => {
    const host = mount(`<div lang="en">${THREE}</div>`);
    const before = host.innerHTML;
    const dispose = mountGallery(host);
    host.querySelector<HTMLElement>('img')!.click();
    dispose();
    expect(dialog()).toBeNull();
    expect(host.innerHTML).toBe(before);
    host.querySelector<HTMLElement>('img')!.click();
    expect(dialog()).toBeNull();
    // And a fresh mount after dispose works again.
    mountGallery(host);
    host.querySelector<HTMLElement>('img')!.click();
    expect(dialog()).not.toBeNull();
  });

  it('keeps a value the host rewrote after mounting', () => {
    const host = mount(`<div lang="en">${THREE}</div>`);
    const dispose = mountGallery(host);
    const image = host.querySelector('img')!;
    image.setAttribute('role', 'presentation');
    dispose();
    expect(image.getAttribute('role')).toBe('presentation');
  });

  it('is self-contained: its serialised form mounts in a fresh document', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.body.innerHTML = THREE;
    const script = `(${mountGallery.toString()})(document);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', script)(fresh);
    const image = fresh.querySelector('img')!;
    expect(image.getAttribute('role')).toBe('button');
    image.click();
    expect(fresh.querySelector('[data-ck-lightbox-counter]')?.textContent).toBe('١ / ٣');
    frame.remove();
  });

  it('stays within 4 kB gzipped', () => {
    expect(gzipSync(mountGallery.toString()).length).toBeLessThanOrEqual(4096);
  });

  it('gates its transitions on the motion preference and keeps logical properties', () => {
    expect(GALLERY_PACK_CSS).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(GALLERY_PACK_CSS).not.toMatch(/(?:^|[\s;{])(?:left|right)\s*:/mu);
    expect(GALLERY_PACK_CSS).toContain("dialog[data-ck-lightbox] button[data-ck-lightbox-nav='prev']");
    expect(GALLERY_PACK_CSS).toContain(':focus-visible');
  });
});
