import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { gzipSync } from 'node:zlib';

import { BEHAVIOR_CSS, ensureBehaviorCss } from './behaviors-css';
import { BEHAVIOR_PACKS, PACK_CSS } from './packs';
import { mountBehaviors } from './runtime';
import {
  BEHAVIOR_RUNTIME_SELECTOR,
  SCRIPT_SELECTOR,
  behaviorRuntimeScript,
  hasBehaviors,
  pageEngines,
} from './script';

describe('behaviorRuntimeScript', () => {
  it('is self-contained: evaluated alone in a fresh document, it mounts count-up', async () => {
    // A fresh realm: an iframe has its own window and document.
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.documentElement.setAttribute('dir', 'rtl');
    fresh.body.innerHTML =
      '<p><span data-ck-behavior="count-up" data-ck-to="250" data-ck-speed="fast">0</span></p>';
    const script = behaviorRuntimeScript();
    expect(script.startsWith('(function')).toBe(true);
    expect(script.endsWith(')(document);')).toBe(true);
    // A scope with only `document` in it: any reference to a module-scope
    // identifier or an import would throw here.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised runtime IS the test
    new Function('document', script)(fresh);
    const counter = fresh.querySelector('span');
    expect(counter?.hasAttribute('data-ck-mounted')).toBe(true);
    await new Promise((done) => setTimeout(done, 1_200));
    expect(counter?.textContent).toBe('٢٥٠');
    frame.remove();
  });
});

describe('hasBehaviors', () => {
  it('reads markup, a DOM node, or a stored JSON value', () => {
    expect(hasBehaviors('<div data-ck-behavior="reveal"></div>')).toBe(true);
    expect(hasBehaviors('<div data-reveal="fade"></div>')).toBe(false);
    const main = document.createElement('main');
    main.innerHTML = '<span data-ck-behavior="tabs"></span>';
    expect(hasBehaviors(main)).toBe(true);
    expect(hasBehaviors(document.createElement('main'))).toBe(false);
    expect(
      hasBehaviors({
        kind: 'root',
        children: [{ kind: 'element', tag: 'div', attributes: { 'data-ck-behavior': 'reveal' } }],
      }),
    ).toBe(true);
    expect(hasBehaviors({ kind: 'root', children: [] })).toBe(false);
    expect(hasBehaviors(null)).toBe(false);
  });
});

describe('BEHAVIOR_CSS', () => {
  it('is held equal to behaviors.css', () => {
    const file = readFileSync(join(process.cwd(), 'src/behaviors/behaviors.css'), 'utf8');
    expect(file).toBe(BEHAVIOR_CSS);
  });

  it('scopes every rule by a behaviour or the lightbox, and gates motion on the preference', () => {
    expect(BEHAVIOR_CSS).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(BEHAVIOR_CSS).toMatch(
      /\[data-ck-behavior='reveal'\]\[data-ck-mounted\]:not\(\.ck-in\)/u,
    );
  });

  it('is injected into a document once', () => {
    document.head.innerHTML = '';
    ensureBehaviorCss(document);
    ensureBehaviorCss(document);
    expect(document.head.querySelectorAll('style[data-ck-behavior-css]')).toHaveLength(1);
    document.head.innerHTML = '';
  });

  it('brings the motion presets and the effects library with it, once each', () => {
    document.head.innerHTML = '';
    ensureBehaviorCss(document);
    ensureBehaviorCss(document);
    const motion = document.head.querySelectorAll('style[data-ck-motion-css]');
    const effects = document.head.querySelectorAll('style[data-ck-effects-css]');
    expect(motion).toHaveLength(1);
    expect(effects).toHaveLength(1);
    expect(motion[0]?.textContent).toContain("[data-ck-motion='fade-up']");
    expect(effects[0]?.textContent).toContain('.ck-fx-glass');
    document.head.innerHTML = '';
  });
});

describe('hasBehaviors — motion', () => {
  it('needs the runtime for a motion or hover preset and for the spotlight effect, not for plain effects', () => {
    expect(hasBehaviors('<h2 data-ck-motion="split-words">x</h2>')).toBe(true);
    expect(hasBehaviors('<a data-ck-hover="magnetic">x</a>')).toBe(true);
    expect(hasBehaviors('<div class="p-4 ck-fx-spotlight">x</div>')).toBe(true);
    expect(hasBehaviors('<div class="ck-fx-glass">x</div>')).toBe(false);
    const main = document.createElement('main');
    main.innerHTML = '<div class="ck-fx-spotlight"></div>';
    expect(hasBehaviors(main)).toBe(true);
    expect(hasBehaviors({ attributes: { 'data-ck-motion': 'fade-up' } })).toBe(true);
    expect(hasBehaviors({ className: 'ck-fx-spotlight' })).toBe(true);
  });
});

/* ── media-motion (2026-10-06): the behaviour packs and the engine markers ── */

/*
  gzip size of `assets/ck-behaviors.js` before the packs: HEAD 9521efa's
  runtime.ts, `(mountBehaviors)(document);` alone, serialised under this same
  vitest transform (measured 2026-10-06 from a temporary copy of the HEAD file:
  42 835 chars, 12 605 B gzip). The packs measured 24 564 B gzip in all then.
*/
const BASELINE_GZIP_BYTES = 12_605;
/*
  14 000 → 16 000 on 2026-10-09 (free-code mode): the `scripts` pack adds 2 669 B gzip to the
  every-pack bundle (25 015 → 27 684 B). It ships only on a site whose markup carries `data-ck-js`
  (see the "ships only the packs" test below), so a page that uses no script pays nothing.
  16 000 → 21 000 on 2026-10-12, measured: the Studio wiring the creative engines added to the
  `scripts` pack (69dca3f) left the every-pack bundle 19 231 B over the runtime, and the Countdown
  block's clock (`countdown-clock`) adds 1 088 B (20 321 B). Both ship only to pages that use them.
*/
const PACKS_BUDGET_GZIP_BYTES = 21_000;

describe('behaviorRuntimeScript — packs', () => {
  it('serialises the core runtime and then every pack, each called on the document', () => {
    const script = behaviorRuntimeScript();
    const calls = script.split('\n').filter((line) => line.endsWith(')(document);'));
    expect(calls.length).toBeGreaterThanOrEqual(1 + BEHAVIOR_PACKS.length);
    for (const mount of [mountBehaviors, ...BEHAVIOR_PACKS])
      expect(script).toContain(mount.toString());
    expect(script.indexOf(mountBehaviors.toString())).toBe(1);
  });

  it('evaluated alone in a fresh document, mounts each pack', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.documentElement.setAttribute('dir', 'rtl');
    fresh.body.innerHTML = [
      '<div id="gallery" data-ck-behavior="gallery"><figure><img src="https://example.com/a.jpg" alt="أ"></figure><figure><img src="https://example.com/b.jpg" alt="ب"></figure></div>',
      '<div id="carousel" data-ck-behavior="carousel"><ul><li>1</li><li>2</li></ul><div><button>prev</button><button>next</button></div></div>',
      '<figure id="player" data-ck-behavior="video-player"><video controls src="https://example.com/a.mp4"></video></figure>',
      '<a id="facade" data-ck-behavior="embed-facade" href="https://www.youtube.com/watch?v=abcdefghijk" aria-label="شغّل"><img src="https://example.com/p.jpg" alt=""></a>',
      '<div id="compare" data-ck-behavior="compare"><img src="https://example.com/1.jpg" alt="قبل"><img src="https://example.com/2.jpg" alt="بعد"></div>',
      '<div id="toggle" data-ck-behavior="toggle-group"><button>شهري / سنوي</button><p data-ck-option="a">10</p><p data-ck-option="b" hidden>100</p></div>',
      '<form id="mailto" data-ck-behavior="mailto-form" data-ck-email="a@example.com"><label>الاسم <input name="name"></label><button>أرسل</button></form>',
      '<section><div id="scene" data-ck-scene="particles"><img src="https://example.com/s.jpg" alt=""></div><h1>مرحبا</h1></section>',
    ].join('');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised runtime IS the test
    new Function('document', behaviorRuntimeScript())(fresh);
    const el = (id: string) => fresh.getElementById(id);
    expect(el('gallery')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(el('carousel')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(el('player')?.hasAttribute('data-ck-player')).toBe(true);
    expect(el('facade')?.hasAttribute('data-ck-facade')).toBe(true);
    expect(el('compare')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(el('toggle')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(el('mailto')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(el('scene')?.hasAttribute('data-ck-engine-mounted')).toBe(true);
    const engines = (
      frame.contentWindow as unknown as { ckEngines?: { queue: { kind: string }[] } }
    ).ckEngines;
    expect(engines?.queue.map((entry) => entry.kind)).toEqual(['scene']);
    frame.remove();
  });

  it('grows ck-behaviors.js by at most 16 kB gzip over the pre-pack runtime', () => {
    const size = gzipSync(behaviorRuntimeScript()).length;
    expect(size - BASELINE_GZIP_BYTES).toBeLessThanOrEqual(PACKS_BUDGET_GZIP_BYTES);
  });

  it('ships only the packs the markup uses (fix pass 2026-10-06: a stagger page paid for every pack)', () => {
    const stagger = behaviorRuntimeScript(['<ul data-ck-behavior="stagger"><li>1</li></ul>']);
    expect(stagger).toContain(mountBehaviors.toString());
    for (const pack of BEHAVIOR_PACKS) expect(stagger).not.toContain(pack.toString());
    expect(gzipSync(stagger).length).toBeLessThanOrEqual(BASELINE_GZIP_BYTES + 512);

    const gallery = behaviorRuntimeScript([
      '<div data-ck-behavior="gallery"></div>',
      '<section><div data-ck-scene="particles"></div></section>',
    ]);
    const included = BEHAVIOR_PACKS.filter((pack) => gallery.includes(pack.toString())).map(
      (pack) => pack.name,
    );
    expect(included).toEqual(['mountGallery', 'mountEngines']);
    // The single-image lightbox is the gallery pack's too.
    expect(behaviorRuntimeScript(["<img data-ck-behavior='lightbox'>"])).toContain(
      'function mountGallery',
    );
  });
});

describe('BEHAVIOR_RUNTIME_SELECTOR — engine markers', () => {
  it('names the engine markers and is the selector inside mountBehaviors', () => {
    for (const marker of ['[data-ck-scene]', '[data-ck-timeline]', '[data-ck-lottie]'])
      expect(BEHAVIOR_RUNTIME_SELECTOR).toContain(marker);
    expect(mountBehaviors.toString()).toContain(BEHAVIOR_RUNTIME_SELECTOR);
  });

  it('makes a page with only an engine marker need the runtime', () => {
    expect(hasBehaviors('<div data-ck-scene="mural"></div>')).toBe(true);
    expect(hasBehaviors('<h2 data-ck-timeline="split-reveal">x</h2>')).toBe(true);
    expect(
      hasBehaviors({
        attributes: { 'data-ck-lottie': '', 'data-ck-src': 'https://a.example/x.json' },
      }),
    ).toBe(true);
    const main = document.createElement('main');
    main.innerHTML = '<div data-ck-timeline="stagger-in"></div>';
    expect(hasBehaviors(main)).toBe(true);
  });
});

describe('pageEngines', () => {
  it('detects carousels in markup, stored trees and a marker root, not ordinary text', () => {
    expect([...pageEngines('<section data-ck-behavior="carousel"></section>')]).toEqual([
      'carousel',
    ]);
    expect([...pageEngines({ attributes: { 'data-ck-behavior': 'carousel' } })]).toEqual([
      'carousel',
    ]);
    const root = document.createElement('section');
    root.setAttribute('data-ck-behavior', 'carousel');
    expect([...pageEngines(root)]).toEqual(['carousel']);
    expect([...pageEngines('<p>carousel</p>')]).toEqual([]);
  });
  it('reads the engines from markup, a DOM node (itself included) and a stored JSON value', () => {
    expect([...pageEngines('<div data-ck-scene="mural"><img src="a"></div>')]).toEqual(['scene']);
    expect(
      [
        ...pageEngines(
          '<h2 class="x" data-ck-timeline="split-reveal">x</h2><div data-ck-lottie="" data-ck-src="y"></div>',
        ),
      ].sort(),
    ).toEqual(['lottie', 'timeline']);
    expect(pageEngines('<p data-ck-scene-canvas="">x</p><p>data-ck-scene</p>').size).toBe(0);
    const node = document.createElement('div');
    node.setAttribute('data-ck-scene', 'particles');
    expect([...pageEngines(node)]).toEqual(['scene']);
    const main = document.createElement('main');
    main.innerHTML = '<h2 data-ck-timeline="stagger-in">x</h2>';
    expect([...pageEngines(main)]).toEqual(['timeline']);
    expect([
      ...pageEngines({ kind: 'root', children: [{ attributes: { 'data-ck-lottie': '' } }] }),
    ]).toEqual(['lottie']);
    expect(pageEngines(null).size).toBe(0);
    expect(pageEngines('<div data-ck-behavior="gallery"></div>').size).toBe(0);
  });
});

describe('BEHAVIOR_CSS — packs', () => {
  it('carries every pack style once, and the old lightbox/carousel rules only from the packs', () => {
    expect(BEHAVIOR_CSS).toContain(PACK_CSS);
    expect(BEHAVIOR_CSS.split("[data-ck-behavior='lightbox'] {").length).toBe(2);
    expect(BEHAVIOR_CSS.split("[data-ck-behavior='carousel'] [data-ck-track] > * {").length).toBe(
      2,
    );
    // gsap-pixi (2026-10-08): a scene HOST keeps its content imgs.
    expect(BEHAVIOR_CSS).toContain(
      '[data-ck-scene][data-ck-ready]:not([data-ck-scene-host]) > img',
    );
  });
});

/* ── free-code mode (2026-10-09): a region's script is a marker, and Pixi is a use ── */

describe('region scripts (data-ck-js)', () => {
  const quoted = (code: string) =>
    `<div data-ck data-ck-custom-code="" data-ck-js="${code}" data-ck-js-id="n1"></div>`;

  it('makes a page with only a script need the runtime, in all four readings', () => {
    expect(hasBehaviors(quoted('ck.root.title = 1'))).toBe(true);
    const main = document.createElement('main');
    main.innerHTML = quoted('ck.root.title = 1');
    expect(hasBehaviors(main)).toBe(true);
    expect(hasBehaviors({ attributes: { 'data-ck-js': 'x' } })).toBe(true);
    expect(hasBehaviors('<p>js</p>')).toBe(false);
  });

  it('keeps BEHAVIOR_RUNTIME_SELECTOR equal to the core runtime: the script marker is not in it', () => {
    expect(BEHAVIOR_RUNTIME_SELECTOR).not.toContain('data-ck-js');
    expect(SCRIPT_SELECTOR).toBe('[data-ck-js]');
  });

  it('reads Pixi from the CODE, not from the marker', () => {
    expect([...pageEngines(quoted('ck.root.title = 1'))]).toEqual([]);
    expect([...pageEngines(quoted('const { app } = await ck.stage();'))]).toEqual(['pixi']);
    expect([...pageEngines(quoted('const PIXI = await ck.pixi();'))]).toEqual(['pixi']);
    expect([...pageEngines(quoted('// a PIXI scene'))]).toEqual(['pixi']);
    expect([...pageEngines(quoted('ck.stage'))]).toEqual(['pixi']);
    // Only inside a script attribute: prose that merely says "pixi" is not a use.
    expect([...pageEngines('<p>pixi dust</p><div data-ck-js-id="n1"></div>')]).toEqual([]);
  });

  it('reads single-quoted attributes, a DOM node (itself included) and a stored JSON value', () => {
    expect([...pageEngines("<div data-ck-js='await ck.stage()'></div>")]).toEqual(['pixi']);

    const own = document.createElement('div');
    own.setAttribute('data-ck-js', 'await ck.stage()');
    expect([...pageEngines(own)]).toEqual(['pixi']);
    const main = document.createElement('main');
    main.innerHTML = quoted('await ck.pixi()');
    expect([...pageEngines(main)]).toEqual(['pixi']);
    const plain = document.createElement('main');
    plain.innerHTML = quoted('ck.root.title = 1');
    expect([...pageEngines(plain)]).toEqual([]);

    expect([...pageEngines({ attributes: { 'data-ck-js': 'await ck.stage()' } })]).toEqual([
      'pixi',
    ]);
    expect([...pageEngines({ attributes: { 'data-ck-js': 'ck.root.title = 1' } })]).toEqual([]);
  });

  it('reads Pixi through the markup escaping React applies to the attribute value', () => {
    expect([
      ...pageEngines(
        '<div data-ck-js="const a = &quot;x&quot;; await ck.stage({ background: &quot;#000&quot; })"></div>',
      ),
    ]).toEqual(['pixi']);
  });

  it('adds the scripts pack to a page that carries one, and to no other', () => {
    const script = behaviorRuntimeScript([quoted('ck.root.title = 1')]);
    const included = BEHAVIOR_PACKS.filter((pack) => script.includes(pack.toString())).map(
      (pack) => pack.name,
    );
    expect(included).toEqual(['mountScripts']);
    expect(behaviorRuntimeScript(['<p>x</p>'])).not.toContain('function mountScripts');
  });
});
