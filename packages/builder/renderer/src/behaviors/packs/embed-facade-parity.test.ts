import { afterEach, describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_IFRAME_ALLOW,
  CUSTOM_CODE_IFRAME_REFERRER_POLICY,
  CUSTOM_CODE_IFRAME_SANDBOX,
  CUSTOM_CODE_IFRAME_SOURCES,
  isAllowedIframeSrc,
} from '@craftkit/builder-schema';

import { mountEmbedFacade } from './embed-facade';

/*
  The facade is serialised into the published page, so it cannot import the
  schema's iframe allowlist and forced policy: it carries inline copies. This
  holds the copies equal to the originals (the BEHAVIOR_RUNTIME_SELECTOR
  precedent in script.ts), and holds every address it derives to the
  allowlist the renderer itself enforces.
*/
const SOURCE = mountEmbedFacade.toString();

function derived(href: string): string | null {
  const host = document.createElement('main');
  host.innerHTML = `<a data-ck-behavior="embed-facade" href="${href}"><img src="https://images.example/p.jpg" alt="x"></a>`;
  document.body.appendChild(host);
  host.addEventListener('click', (event) => {
    event.preventDefault();
  });
  mountEmbedFacade(host);
  host.querySelector('a')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return host.querySelector('iframe')?.getAttribute('src') ?? null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('embed-facade parity with the schema iframe policy', () => {
  it('forces the same sandbox, permissions and referrer policy', () => {
    expect(SOURCE).toContain(CUSTOM_CODE_IFRAME_SANDBOX);
    expect(SOURCE).toContain(CUSTOM_CODE_IFRAME_ALLOW);
    expect(SOURCE).toContain(CUSTOM_CODE_IFRAME_REFERRER_POLICY);
  });

  it('carries the YouTube and Vimeo allowlist patterns verbatim', () => {
    for (const prefix of ['https://www.youtube-nocookie.com/', 'https://player.vimeo.com/']) {
      const source = CUSTOM_CODE_IFRAME_SOURCES.find((entry) => entry.example.startsWith(prefix));
      expect(source, prefix).toBeDefined();
      expect(SOURCE).toContain(source?.pattern.source ?? '<missing>');
    }
  });

  it('derives YouTube and Vimeo addresses the allowlist admits', () => {
    for (const href of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/abcDEF12345',
      'https://vimeo.com/76979871',
    ]) {
      const src = derived(href);
      expect(src, href).not.toBeNull();
      expect(isAllowedIframeSrc(src ?? ''), `${href} -> ${String(src)}`).toBe(true);
    }
  });

  /*
    DEPENDENT: the keyless Maps embed (`https://www.google.com/maps?q=…&output=embed`)
    is admitted by a CUSTOM_CODE_IFRAME_SOURCES pattern that the schema-media
    package adds in the same wave (media-motion DESIGN §E). Until it lands this
    case fails, by design: the facade would build a frame the renderer refuses.
  */
  it('derives a keyless Maps address the allowlist admits (depends on schema-media)', () => {
    const keyless = CUSTOM_CODE_IFRAME_SOURCES.find((entry) =>
      entry.example.startsWith('https://www.google.com/maps?q='),
    );
    expect(keyless, 'the keyless Maps pattern').toBeDefined();
    expect(SOURCE).toContain(keyless?.pattern.source ?? '<missing>');
    for (const href of [
      'https://www.google.com/maps?q=Petra%2C%20Jordan',
      'https://www.google.com/maps/place/%D8%A7%D9%84%D8%A8%D8%AA%D8%B1%D8%A7%D8%A1/@30.32,35.44,15z',
    ]) {
      const src = derived(href);
      expect(src, href).not.toBeNull();
      expect(isAllowedIframeSrc(src ?? ''), `${href} -> ${String(src)}`).toBe(true);
    }
  });
});
