import { afterEach, describe, expect, it, vi } from 'vitest';

const inject = vi.hoisted(() => ({ dispose: vi.fn(), calls: [] as ParentNode[] }));

vi.mock('../engines/inject', () => ({
  ensureCanvasEngines: (root: ParentNode) => {
    inject.calls.push(root);
    return inject.dispose;
  },
}));

import { mountRegionScripts, mountSiteBehaviors } from './mount';

function host(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

const MARKUP = [
  '<div id="reveal" data-ck-behavior="reveal">r</div>',
  '<div id="gallery" data-ck-behavior="gallery"><figure><img src="https://example.com/a.jpg" alt="a"></figure></div>',
  '<div id="toggle" data-ck-behavior="toggle-group"><button>x</button><p data-ck-option="a">a</p><p data-ck-option="b" hidden>b</p></div>',
  '<div id="scene" data-ck-scene="particles"><img src="https://example.com/s.jpg" alt=""></div>',
].join('');

afterEach(() => {
  inject.calls.length = 0;
  inject.dispose.mockClear();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as { ckEngines?: unknown }).ckEngines;
});

describe('mountSiteBehaviors', () => {
  it('mounts the core runtime and every pack on one root, and injects the canvas engines', () => {
    const root = host(MARKUP);
    mountSiteBehaviors(root);
    expect(root.querySelector('#reveal')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(root.querySelector('#gallery')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(root.querySelector('#toggle')?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(root.querySelector('#scene')?.hasAttribute('data-ck-engine-mounted')).toBe(true);
    expect(inject.calls).toEqual([root]);
  });

  it('leaves loading to the engines pack on an exported page (a prefetch link), but not on the canvas', () => {
    document.head.innerHTML = '<link rel="prefetch" as="script" href="/assets/ck-scene.js" data-ck-engine="scene">';
    mountSiteBehaviors(host(MARKUP));
    expect(inject.calls).toHaveLength(0);
    const canvas = host(MARKUP);
    mountSiteBehaviors(canvas, { interactive: false });
    expect(inject.calls).toEqual([canvas]);
  });

  it('returns one disposer that undoes every part, once', () => {
    const root = host(MARKUP);
    const dispose = mountSiteBehaviors(root);
    dispose();
    dispose();
    expect(root.querySelector('#reveal')?.hasAttribute('data-ck-mounted')).toBe(false);
    expect(root.querySelector('#gallery')?.hasAttribute('data-ck-mounted')).toBe(false);
    expect(root.querySelector('#scene')?.hasAttribute('data-ck-engine-mounted')).toBe(false);
    expect((window as unknown as { ckEngines?: { queue: unknown[] } }).ckEngines?.queue).toEqual([]);
    expect(inject.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the canvas still: the click-driven gallery stays inert', () => {
    const root = host(MARKUP);
    mountSiteBehaviors(root, { interactive: false });
    root.querySelector('img')?.click();
    expect(document.querySelector('dialog[data-ck-lightbox]')).toBeNull();
  });
});

describe('region scripts (free-code mode, 2026-10-09)', () => {
  const SCRIPT = `<div id="s" data-ck-js-id="s" data-ck-js="ck.root.setAttribute('data-ran', 'yes')"></div>`;

  it('mountSiteBehaviors runs the scripts pack with the rest, unless told not to', () => {
    const on = host(SCRIPT);
    mountSiteBehaviors(on)();
    expect(on.querySelector('#s')?.getAttribute('data-ran')).toBe('yes');

    document.body.innerHTML = '';
    const off = host(SCRIPT);
    mountSiteBehaviors(off, { scripts: false })();
    expect(off.querySelector('#s')?.hasAttribute('data-ran')).toBe(false);
  });

  it('mountRegionScripts runs the script and injects the canvas engines it may need, with ONE disposer', () => {
    const root = host(SCRIPT);
    const dispose = mountRegionScripts(root, { interactive: false, watch: false });
    expect(root.querySelector('#s')?.getAttribute('data-ran')).toBe('yes');
    expect(inject.calls).toEqual([root]);
    dispose();
    dispose();
    expect(inject.dispose).toHaveBeenCalledTimes(1);
  });

  it('mountRegionScripts leaves engine loading to the page where an exported locator link exists', () => {
    document.head.innerHTML = '<link rel="ck-engine" href="/assets/ck-pixi.js" data-ck-engine="pixi">';
    mountRegionScripts(host(SCRIPT))();
    expect(inject.calls).toHaveLength(0);
  });
});
