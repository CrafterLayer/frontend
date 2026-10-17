import { afterEach, describe, expect, it, vi } from 'vitest';

const inject = vi.hoisted(() => ({ dispose: vi.fn(), calls: [] as ParentNode[] }));

vi.mock('./inject', () => ({
  ensureCanvasEngines: (root: ParentNode) => {
    inject.calls.push(root);
    return inject.dispose;
  },
}));

import { ensureCkEngines, type CkEngineContext, type CkEnginesHost } from './ck-engines-shim';
import { mountDocumentEngines } from './document-engines';

/* Longer than the re-scan debounce, so one wait sees the folded scan. */
const rescan = () => new Promise((done) => setTimeout(done, 80));

function body(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

/** A registered engine: records each mount and returns a disposer spy per mount. */
function engine(kind: 'scene' | 'timeline' | 'lottie') {
  const mounts: { el: HTMLElement; ctx: CkEngineContext; stop: ReturnType<typeof vi.fn> }[] = [];
  ensureCkEngines(window as unknown as CkEnginesHost).ready(kind, {
    mount: (el, ctx) => {
      const stop = vi.fn();
      mounts.push({ el, ctx, stop });
      return stop;
    },
  });
  return mounts;
}

afterEach(() => {
  inject.calls.length = 0;
  inject.dispose.mockClear();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as CkEnginesHost).ckEngines;
});

const PAGE = [
  '<section id="hero" data-ck-scene="particles" data-ck-timeline="fade-in"><h2 id="title" data-ck-timeline="split-reveal">مرحبا</h2></section>',
  '<div data-ck-custom-code=""><div id="region-scene" data-ck-scene="mural"></div><h3 id="region-title" data-ck-timeline="stagger-in">x</h3></div>',
].join('');

describe('mountDocumentEngines', () => {
  it('mounts every marker outside customCode regions, element by element, scene and timeline together', () => {
    const scenes = engine('scene');
    const timelines = engine('timeline');
    const root = body(PAGE);
    const dispose = mountDocumentEngines(root, { interactive: false });

    expect(scenes.map((mount) => mount.el.id)).toEqual(['hero']);
    expect(timelines.map((mount) => mount.el.id)).toEqual(['hero', 'title']);
    expect(scenes[0]?.ctx).toMatchObject({ still: false, canvas: true, rtl: false });
    expect(root.querySelector('#region-scene')?.hasAttribute('data-ck-engine-mounted')).toBe(false);
    expect(root.querySelector('#region-title')?.hasAttribute('data-ck-engine-mounted')).toBe(false);
    expect(inject.calls).toEqual([root]);
    dispose();
  });

  it('passes the published context in Preview, and leaves loading to the locator links of a published page', () => {
    const timelines = engine('timeline');
    document.head.innerHTML =
      '<link rel="ck-engine" href="/assets/ck-timeline.js" data-ck-engine="timeline">';
    const root = body('<h2 data-ck-timeline="fade-in">x</h2>');
    mountDocumentEngines(root, { interactive: true })();
    expect(timelines[0]?.ctx).toMatchObject({ still: false, canvas: false });
    expect(inject.calls).toEqual([]);
  });

  it('mounts a marker node added later, once, after one debounced re-scan', async () => {
    const timelines = engine('timeline');
    const root = body('<p>still</p>');
    const dispose = mountDocumentEngines(root, { interactive: false });
    expect(inject.calls).toEqual([]);

    const section = document.createElement('section');
    section.innerHTML = '<h2 data-ck-timeline="slide-in">x</h2>';
    root.appendChild(section);
    expect(timelines).toHaveLength(0);
    await rescan();
    expect(timelines.map((mount) => mount.el.localName)).toEqual(['h2']);
    expect(inject.calls).toEqual([root]);
    dispose();
  });

  it('disposes a removed element, and re-mounts one whose marker or params changed', async () => {
    const scenes = engine('scene');
    const timelines = engine('timeline');
    const root = body(PAGE);
    const dispose = mountDocumentEngines(root, { interactive: false });
    const hero = root.querySelector<HTMLElement>('#hero')!;

    hero.setAttribute('data-ck-density', 'high');
    await rescan();
    expect(scenes[0]?.stop).toHaveBeenCalledTimes(1);
    expect(scenes).toHaveLength(2);
    expect(timelines.filter((mount) => mount.el === hero)).toHaveLength(2);

    root.querySelector('#title')?.setAttribute('data-ck-timeline', 'stagger-in');
    await rescan();
    const titleMounts = timelines.filter((mount) => mount.el.id === 'title');
    expect(titleMounts).toHaveLength(2);
    expect(titleMounts[0]?.stop).toHaveBeenCalledTimes(1);

    hero.remove();
    await rescan();
    expect(scenes[1]?.stop).toHaveBeenCalledTimes(1);
    expect(titleMounts[1]?.stop).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('a marker removed from an element disposes it', async () => {
    const timelines = engine('timeline');
    const root = body('<h2 data-ck-timeline="fade-in">x</h2>');
    const dispose = mountDocumentEngines(root, { interactive: false });
    root.querySelector('h2')?.removeAttribute('data-ck-timeline');
    await rescan();
    expect(timelines[0]?.stop).toHaveBeenCalledTimes(1);
    expect(root.querySelector('h2')?.hasAttribute('data-ck-engine-mounted')).toBe(false);
    dispose();
  });

  it('ignores unrelated mutations, the engines’ own nodes and everything inside a customCode region', async () => {
    const scenes = engine('scene');
    const timelines = engine('timeline');
    const root = body(PAGE);
    const dispose = mountDocumentEngines(root, { interactive: false });
    const hero = root.querySelector<HTMLElement>('#hero')!;

    hero.appendChild(document.createElement('p')).textContent = 'new copy';
    const layer = document.createElement('div');
    layer.setAttribute('data-ck-scene-layer', '');
    hero.insertBefore(layer, hero.firstChild);
    hero.setAttribute('data-ck-ready', '');
    hero.setAttribute('data-ck-scene-host', '');
    root.querySelector('#region-scene')?.setAttribute('data-ck-density', 'low');
    root
      .querySelector('[data-ck-custom-code]')
      ?.insertAdjacentHTML('beforeend', '<div data-ck-scene="particles"></div>');
    await rescan();

    expect(scenes).toHaveLength(1);
    expect(timelines).toHaveLength(2);
    expect(scenes[0]?.stop).not.toHaveBeenCalled();
    dispose();
  });

  it('one disposer stops observing, disposes every mount and cancels the injections', async () => {
    const scenes = engine('scene');
    const root = body(PAGE);
    const dispose = mountDocumentEngines(root, { interactive: false });
    dispose();
    dispose();
    expect(scenes[0]?.stop).toHaveBeenCalledTimes(1);
    expect(inject.dispose).toHaveBeenCalledTimes(1);
    expect(root.querySelector('#hero')?.hasAttribute('data-ck-engine-mounted')).toBe(false);

    root.insertAdjacentHTML('beforeend', '<div data-ck-scene="particles"><h2>x</h2></div>');
    await rescan();
    expect(scenes).toHaveLength(1);
  });

  it('does nothing under reduced motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('reduce'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const root = body(PAGE);
    const dispose = mountDocumentEngines(root, { interactive: false });
    root.insertAdjacentHTML('beforeend', '<h2 data-ck-timeline="fade-in">x</h2>');
    await rescan();
    expect((window as unknown as CkEnginesHost).ckEngines).toBeUndefined();
    expect(inject.calls).toEqual([]);
    expect(root.querySelector('[data-ck-engine-mounted]')).toBeNull();
    dispose();
  });
});
