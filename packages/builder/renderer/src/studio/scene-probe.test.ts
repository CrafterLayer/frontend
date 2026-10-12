import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EngineLoader } from '../engines/inject';
import {
  probeScene,
  sceneProbePasses,
  sceneProbeSource,
  type SceneProbeSection,
} from './scene-probe';
import type { SceneProbeFrameReport, SceneProbeFrameResult } from './scene-probe-report';
import { runSceneProbeFrame, type SceneProbeFrameArgs } from './scene-probe-runner';

/*
  creative-power Phase 2 E (2026-10-12): `probeScene` — which passes run, the region it renders,
  the documents it builds, its budget, Stop, and the browser runner's frame. The passes' frames
  are faked here; apps/evals pixi-creative/probe.browser.test.ts runs them in Chromium.
*/

function stand(kind: string): EngineLoader {
  return () => Promise.resolve(`/* ${kind} stand-in */`);
}
const loaders = { pixi: stand('pixi'), 'lib-kit': stand('lib-kit'), 'lib-fx': stand('lib-fx') };

const SCENE =
  "const s=await ck.scene({libs:['fx']});\nconst g=new s.PIXI.Graphics();s.stage.addChild(g);";

const SECTION: SceneProbeSection = {
  tree: {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        className: 'ck-scene py-16',
        children: [{ kind: 'element', tag: 'button', text: 'Start', children: [] }],
      },
    ],
  },
  css: '.ck-scene{position:relative;min-height:320px}',
  js: SCENE,
  jsParams: { speed: 2 },
};

const FRAME: SceneProbeFrameReport = {
  viewport: { width: 1280, height: 720 },
  region: { x: 0, y: 0, width: 1280, height: 720 },
  canvas: { rect: { x: 0, y: 0, width: 1280, height: 720 }, width: 1280, height: 720 },
  covers: true,
  controls: [],
  overflowX: 0,
  blank: false,
  ink: 0.4,
  fps: 60,
  errors: [],
  click: null,
  hidden: false,
  settledMs: 800,
  waitedMs: 100,
  ranMs: 600,
};

function fakeRunner(
  result: SceneProbeFrameResult = { status: 'done', report: FRAME },
  takesMs = 0,
) {
  const seen: SceneProbeFrameArgs[] = [];
  const runPass = vi.fn(async (args: SceneProbeFrameArgs) => {
    seen.push(args);
    if (takesMs > 0) await new Promise((done) => setTimeout(done, takesMs));
    return result;
  });
  return { seen, runPass };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sceneProbePasses', () => {
  it('runs desktop (clicking), phone and reduced motion, in the page’s direction', () => {
    expect(sceneProbePasses({})).toEqual([
      {
        name: 'desktop',
        width: 1280,
        height: 720,
        lang: 'en',
        dir: 'ltr',
        reducedMotion: false,
        click: true,
      },
      {
        name: 'mobile',
        width: 390,
        height: 700,
        lang: 'en',
        dir: 'ltr',
        reducedMotion: false,
        click: false,
      },
      {
        name: 'reduced-motion',
        width: 1280,
        height: 720,
        lang: 'en',
        dir: 'ltr',
        reducedMotion: true,
        click: false,
      },
    ]);
    // An Arabic page runs right-to-left in every pass.
    expect(sceneProbePasses({ lang: 'ar' }).map(({ dir }) => dir)).toEqual(['rtl', 'rtl', 'rtl']);
    expect(sceneProbePasses({ lang: 'ar-JO', dir: 'ltr' })[0]?.dir).toBe('ltr');
    const custom = sceneProbePasses({
      viewports: [
        { width: 1440, height: 900 },
        { width: 360, height: 640 },
      ],
      skipReducedMotion: true,
      click: false,
    });
    expect(custom.map(({ name, width, click }) => [name, width, click])).toEqual([
      ['desktop', 1440, false],
      ['mobile', 360, false],
    ]);
  });
});

describe('sceneProbeSource', () => {
  it('renders the section as the published page does: code, params and tree on the region', async () => {
    const source = await sceneProbeSource({ section: SECTION });
    const region = new DOMParser()
      .parseFromString(source.markup, 'text/html')
      .querySelector('[data-ck-js]');
    expect(region?.getAttribute('data-ck-js')).toBe(SCENE);
    expect(region?.getAttribute('data-ck-params')).toBe('{"speed":2}');
    expect(region?.hasAttribute('data-ck-custom-code')).toBe(true);
    expect(region?.querySelector('section.ck-scene > button')?.textContent).toBe('Start');
    expect(source.code).toBe(SCENE);
    expect(source.css).toContain('.ck-scene{position:relative;min-height:320px}');
    // `py-16` is Tailwind's, and nothing compiled it: layout verdicts would be guesses.
    expect(source.stylesComplete).toBe(false);
  });

  it('compiles the classes the CSS does not cover, and is complete once it has', async () => {
    const compileClasses = vi.fn((names: Iterable<string>) =>
      Promise.resolve(`/* ${[...names].join(' ')} */.py-16{padding-block:4rem}`),
    );
    const source = await sceneProbeSource({
      section: SECTION,
      themeCss: ':root{--t-accent:#0a7}',
      compileClasses,
    });
    expect(compileClasses).toHaveBeenCalledWith(['ck-scene', 'py-16']);
    expect(source.stylesComplete).toBe(true);
    expect(source.css.indexOf('--t-accent')).toBeLessThan(source.css.indexOf('.py-16'));
    expect(source.css.indexOf('.py-16')).toBeLessThan(source.css.indexOf('.ck-scene{'));

    const failing = await sceneProbeSource({
      section: SECTION,
      compileClasses: () => Promise.reject(new Error('no Tailwind here')),
    });
    expect(failing.stylesComplete).toBe(false);
    const written = await sceneProbeSource({ section: { ...SECTION, css: '.py-16{padding:0}' } });
    expect(written.stylesComplete).toBe(true);
  });

  it('takes markup as given and reads its code from the region', async () => {
    const html =
      '<div data-ck-js="const s=await ck.scene({}); // &quot;q&quot; &amp; &lt;b&gt;"></div>';
    const source = await sceneProbeSource({ html });
    expect(source.markup).toBe(html);
    expect(source.code).toBe('const s=await ck.scene({}); // "q" & <b>');
    expect(source.stylesComplete).toBe(true);
  });
});

describe('probeScene', () => {
  it('builds one probe document per pass and reports each pass', async () => {
    const { seen, runPass } = fakeRunner();
    const report = await probeScene({ section: SECTION, lang: 'ar', loaders, runPass });

    expect(report).toMatchObject({ version: 1, status: 'done', expectCanvas: true, skipped: [] });
    expect(report.stylesComplete).toBe(false);
    expect(report.passes.map(({ pass, status }) => [pass.name, status])).toEqual([
      ['desktop', 'done'],
      ['mobile', 'done'],
      ['reduced-motion', 'done'],
    ]);
    expect(report.passes[0]?.report).toEqual(FRAME);
    expect(seen.map(({ width, height }) => [width, height])).toEqual([
      [1280, 720],
      [390, 700],
      [1280, 720],
    ]);
    for (const { html, timeoutMs } of seen) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
      // The section runs in place of the code-only region, with the probe and its contexts.
      expect(doc.querySelector('#ck-preview > [data-ck-js]')?.getAttribute('data-ck-js')).toBe(
        SCENE,
      );
      expect(doc.getElementById('ck-preview')?.hasAttribute('data-ck-js')).toBe(false);
      expect(html).toContain('function studioSceneProbe(');
      expect(html).toContain('function studioProbeContexts(');
      expect(timeoutMs).toBeGreaterThan(0);
      expect(timeoutMs).toBeLessThanOrEqual(6_000);
    }
    expect(seen[0]?.html).toContain('"click":true');
    expect(seen[1]?.html).toContain('"click":false');
    expect(seen[2]?.html).toMatch(
      /\}\)\(window, function mountScripts\([\s\S]*, true, function probe\(/u,
    );
  });

  it('skips the passes its budget has no room for, the desktop pass first in line', async () => {
    const { runPass } = fakeRunner({ status: 'done', report: FRAME }, 200);
    const report = await probeScene({ section: SECTION, loaders, runPass, budgetMs: 1_000 });
    expect(report.status).toBe('partial');
    expect(report.passes.map(({ pass }) => pass.name)).toEqual(['desktop']);
    expect(report.skipped).toEqual(['mobile', 'reduced-motion']);
  });

  it('stops on the signal, before a pass or when a pass was stopped', async () => {
    const stopped = new AbortController();
    stopped.abort();
    const { runPass } = fakeRunner();
    const before = await probeScene({ section: SECTION, loaders, runPass, signal: stopped.signal });
    expect(before).toMatchObject({ status: 'aborted', passes: [] });
    expect(runPass).not.toHaveBeenCalled();

    const during = fakeRunner({ status: 'aborted', report: null, failure: 'Stopped.' });
    const cut = await probeScene({ section: SECTION, loaders, runPass: during.runPass });
    expect(cut.status).toBe('aborted');
    expect(cut.passes).toHaveLength(1);
  });

  it('measures nothing without a DOM, or without code', async () => {
    vi.stubGlobal('document', undefined);
    const headless = await probeScene({ section: SECTION });
    expect(headless).toMatchObject({ status: 'unavailable', passes: [], expectCanvas: true });
    vi.unstubAllGlobals();
    const { runPass } = fakeRunner();
    const quiet = await probeScene({ section: { ...SECTION, js: '  ' }, runPass });
    expect(quiet.status).toBe('unavailable');
    expect(runPass).not.toHaveBeenCalled();
  });
});

describe('runSceneProbeFrame (the browser runner)', () => {
  function mounted(): HTMLIFrameElement {
    const iframe = document.querySelector('iframe');
    if (iframe === null) throw new Error('no probe frame');
    return iframe;
  }

  function reply(iframe: HTMLIFrameElement, data: unknown, source: unknown = iframe.contentWindow) {
    window.dispatchEvent(new MessageEvent('message', { data, source: source as Window }));
  }

  it('mounts a sandboxed, inert frame at the pass’s size and resolves with its report', async () => {
    const done = runSceneProbeFrame({
      html: '<!doctype html><p>probe</p>',
      width: 390,
      height: 700,
      timeoutMs: 2_000,
    });
    const iframe = mounted();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('aria-hidden')).toBe('true');
    expect(iframe.style.width).toBe('390px');
    expect(iframe.style.height).toBe('700px');
    expect(iframe.style.pointerEvents).toBe('none');
    // Never fully transparent: Chromium would not composite it, and its canvas would stall.
    expect(iframe.style.opacity).toBe('0.01');
    reply(iframe, { type: 'ck-preview:probe', report: FRAME }, window);
    reply(iframe, { type: 'ck-preview:fps', fps: 60 });
    reply(iframe, { type: 'ck-preview:probe', report: FRAME });
    await expect(done).resolves.toEqual({ status: 'done', report: FRAME });
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('reports a frame that failed, never answered, or was stopped', async () => {
    const failed = runSceneProbeFrame({ html: '', width: 10, height: 10, timeoutMs: 2_000 });
    reply(mounted(), { type: 'ck-preview:probe', report: null, failure: 'TypeError: x' });
    await expect(failed).resolves.toEqual({
      status: 'failed',
      report: null,
      failure: 'TypeError: x',
    });

    const late = await runSceneProbeFrame({ html: '', width: 10, height: 10, timeoutMs: 30 });
    expect(late).toMatchObject({ status: 'timeout', report: null });
    expect(document.querySelector('iframe')).toBeNull();

    const stop = new AbortController();
    const stopped = runSceneProbeFrame(
      { html: '', width: 10, height: 10, timeoutMs: 2_000 },
      stop.signal,
    );
    stop.abort();
    await expect(stopped).resolves.toMatchObject({ status: 'aborted' });
    expect(document.querySelector('iframe')).toBeNull();
    stop.abort();
    await expect(
      runSceneProbeFrame({ html: '', width: 10, height: 10, timeoutMs: 2_000 }, stop.signal),
    ).resolves.toMatchObject({ status: 'aborted' });
  });
});
