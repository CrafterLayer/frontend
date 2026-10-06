import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { mountEmbedFacade } from './embed-facade';

function facade(href: string, label = 'شغّل: جولة في المطبخ'): string {
  return `<a data-ck-behavior="embed-facade" href="${href}" aria-label="${label}" class="relative block aspect-video">
  <img src="https://images.example/poster.jpg" alt="" loading="lazy" decoding="async">
  <span class="ck-play-badge" aria-hidden="true"></span>
</a>`;
}

function stage(html: string, lang = 'ar'): HTMLElement {
  const host = document.createElement('main');
  host.setAttribute('lang', lang);
  host.innerHTML = html;
  document.body.appendChild(host);
  // jsdom does not navigate: stop any click the pack let through from trying.
  host.addEventListener('click', (event) => {
    event.preventDefault();
  });
  return host;
}

function activate(host: HTMLElement, init: MouseEventInit = {}): HTMLIFrameElement | null {
  host
    .querySelector('a')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  return host.querySelector('iframe');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountEmbedFacade', () => {
  it('swaps a YouTube link for a privacy-enhanced iframe with the forced policy, and moves focus into it', () => {
    const host = stage(facade('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'));
    mountEmbedFacade(host);
    const frame = activate(host);
    expect(frame?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation allow-popups');
    expect(frame?.getAttribute('allow')).toContain('autoplay');
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame?.hasAttribute('allowfullscreen')).toBe(true);
    expect(frame?.getAttribute('title')).toBe('شغّل: جولة في المطبخ');
    expect(document.activeElement).toBe(frame);
    const link = host.querySelector('a');
    expect(link?.getAttribute('tabindex')).toBe('-1');
    expect(host.querySelector('img')?.hasAttribute('hidden')).toBe(true);
    // A second activation adds nothing.
    activate(host);
    expect(host.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('reads youtu.be, shorts and Vimeo links', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'],
      ['https://www.youtube.com/shorts/abcDEF12345', 'https://www.youtube-nocookie.com/embed/abcDEF12345?autoplay=1'],
      ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871?autoplay=1'],
    ];
    for (const [href, src] of cases) {
      const host = stage(facade(href));
      mountEmbedFacade(host);
      expect(activate(host)?.getAttribute('src')).toBe(src);
      host.remove();
    }
  });

  it('reads a Google Maps link by query, by place path, and by coordinates', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['https://www.google.com/maps?q=Petra%2C%20Jordan', 'https://www.google.com/maps?q=Petra%2C%20Jordan&output=embed'],
      [
        'https://www.google.com/maps/place/%D8%A7%D9%84%D8%A8%D8%AA%D8%B1%D8%A7%D8%A1/@30.32,35.44,15z',
        `https://www.google.com/maps?q=${encodeURIComponent('البتراء')}&output=embed`,
      ],
      ['https://www.google.com/maps/@31.95,35.91,14z', 'https://www.google.com/maps?q=31.95%2C35.91&output=embed'],
    ];
    for (const [href, src] of cases) {
      const host = stage(facade(href, ''));
      mountEmbedFacade(host);
      const frame = activate(host);
      expect(frame?.getAttribute('src')).toBe(src);
      expect(frame?.getAttribute('title')).toBe('خريطة');
      host.remove();
    }
  });

  it('creates no iframe on the canvas: a click there selects', () => {
    const host = stage(facade('https://youtu.be/dQw4w9WgXcQ'));
    mountEmbedFacade(host, { interactive: false });
    expect(activate(host)).toBeNull();
    expect(host.querySelector('a')?.getAttribute('data-ck-facade')).toBe('still');
  });

  it('leaves a modified click (new tab) and an unknown link alone', () => {
    const host = stage(facade('https://youtu.be/dQw4w9WgXcQ'));
    mountEmbedFacade(host);
    expect(activate(host, { ctrlKey: true })).toBeNull();
    const other = stage(facade('https://example.com/watch?v=dQw4w9WgXcQ'));
    mountEmbedFacade(other);
    expect(other.querySelector('a')?.hasAttribute('data-ck-facade')).toBe(false);
    expect(activate(other)).toBeNull();
  });

  it('restores the link exactly on dispose, text children included, and is idempotent', () => {
    const host = stage(
      '<a data-ck-behavior="embed-facade" href="https://youtu.be/dQw4w9WgXcQ">شاهد <img src="https://images.example/p.jpg" alt="جولة"> الآن</a>',
    );
    const before = host.innerHTML;
    const first = mountEmbedFacade(host);
    const second = mountEmbedFacade(host);
    const frame = activate(host);
    expect(frame?.getAttribute('title')).toBe('جولة');
    expect(host.querySelector('a')?.textContent).toBe('');
    second();
    first();
    first();
    expect(host.innerHTML).toBe(before);
    expect(host.querySelector('iframe')).toBeNull();
  });

  it('is self-contained: its serialised form mounts in a fresh document', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument;
    if (fresh === null) throw new Error('no frame document');
    fresh.documentElement.setAttribute('lang', 'en');
    fresh.body.innerHTML = facade('https://vimeo.com/76979871', '');
    const script = `(${mountEmbedFacade.toString()})(document);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', script)(fresh);
    const link = fresh.querySelector('a');
    link?.addEventListener('click', (event) => {
      event.preventDefault();
    });
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(fresh.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://player.vimeo.com/video/76979871?autoplay=1',
    );
    expect(fresh.querySelector('iframe')?.getAttribute('title')).toBe('Video');
    frame.remove();
  });

  it('stays within its size budget: at most 3.5 kB gzip serialised', () => {
    expect(gzipSync(mountEmbedFacade.toString()).length).toBeLessThanOrEqual(3584);
  });
});
