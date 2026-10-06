import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BEHAVIOR_CSS, ensureBehaviorCss } from './behaviors-css';
import { behaviorRuntimeScript, hasBehaviors } from './script';

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
