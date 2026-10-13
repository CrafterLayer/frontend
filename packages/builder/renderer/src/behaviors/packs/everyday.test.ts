import { afterEach, describe, expect, it } from 'vitest';

import { behaviorRuntimeScript, pageBehaviorPacks } from '../script';
import { mountBehaviors } from '../runtime';
import { mountBackToTop } from './back-to-top';
import { mountDismiss } from './dismiss';
import { mountFilter } from './filter';
import { mountReadMore } from './read-more';
import { mountScrollSpy } from './scroll-spy';
import { mountTypedWords } from './typed-words';

/*
  The everyday site behaviours (2026-10-13) as the published page runs them: serialised by
  `Function.prototype.toString` into `ck-behaviors.js` and evaluated alone in a fresh document,
  which holds each pack to "no imports, no module-scope reads".
*/
const MARKUP = [
  '<header style="position: sticky; top: 0"><nav id="spy" data-ck-behavior="scroll-spy"><a href="#one">١</a><a href="#two">٢</a></nav></header>',
  '<div id="notice" data-ck-behavior="dismiss"><p>توصيل مجاني</p><button type="button" aria-label="إغلاق" hidden>×</button></div>',
  '<h1>نصمم <span id="typed" data-ck-behavior="typed-words"><span>مواقع</span><span hidden>متاجر</span></span></h1>',
  '<section id="one"><div id="more" data-ck-behavior="read-more" data-ck-text="أقل"><p>نص طويل</p><button type="button" hidden>المزيد</button></div></section>',
  '<section id="two"><div id="filter" data-ck-behavior="filter"><button type="button" data-ck-filter="all">الكل</button><button type="button" data-ck-filter="web">ويب</button><article data-ck-filter="web">أ</article><article data-ck-filter="print">ب</article></div></section>',
  '<a id="top" href="#top" data-ck-behavior="back-to-top" aria-label="إلى الأعلى">↑</a>',
].join('');

const EVERYDAY = [
  mountBackToTop,
  mountReadMore,
  mountScrollSpy,
  mountTypedWords,
  mountFilter,
  mountDismiss,
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the everyday behaviour packs, serialised', () => {
  it('ship with the core runtime only to the pages whose markup names them', () => {
    expect(pageBehaviorPacks(MARKUP)).toEqual(EVERYDAY);
    const script = behaviorRuntimeScript([MARKUP]);
    expect(script.startsWith(`(${mountBehaviors.toString()})(document);`)).toBe(true);
    for (const pack of EVERYDAY) expect(script).toContain(pack.toString());
    expect(script).not.toMatch(/\beval\(|new Function|\.innerHTML\s*=|setAttribute\(\s*['"]on/u);
  });

  it('evaluated alone in a fresh right-to-left document, each one mounts', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    const view = frame.contentWindow as Window & typeof globalThis;
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.documentElement.setAttribute('dir', 'rtl');
    fresh.body.innerHTML = MARKUP;
    Object.defineProperty(view.HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 400,
    });
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised runtime IS the test
    new Function('document', behaviorRuntimeScript([MARKUP]))(fresh);
    const el = (id: string) => fresh.getElementById(id)!;
    expect(el('top').style.visibility).toBe('hidden');
    expect(el('more').querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    expect(el('spy').querySelector('[aria-current="true"]')).not.toBeNull();
    expect(el('typed').lastElementChild?.textContent).toBe('مواقع, متاجر');
    expect(el('filter').querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    expect(el('notice').querySelector('button')?.hidden).toBe(false);
    frame.remove();
  });
});
