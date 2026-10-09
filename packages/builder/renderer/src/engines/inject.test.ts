import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ENGINE_LOADERS, ensureCanvasEngines, type EngineLoader } from './inject';

const flush = () => new Promise((done) => setTimeout(done, 0));

function host(html: string, doc: Document = document): HTMLElement {
  const el = doc.createElement('div');
  el.innerHTML = html;
  doc.body.appendChild(el);
  return el;
}

function loaders() {
  return {
    scene: vi.fn<EngineLoader>(() => Promise.resolve('/* scene */')),
    timeline: vi.fn<EngineLoader>(() => Promise.resolve('/* timeline */')),
    lottie: vi.fn<EngineLoader>(() => Promise.resolve('/* lottie */')),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('ensureCanvasEngines', () => {
  it('appends one script per engine the root uses to its own document head, once', async () => {
    const load = loaders();
    const root = host('<div data-ck-scene="mural"></div><h2 data-ck-timeline="split-reveal">x</h2>');
    ensureCanvasEngines(root, { loaders: load });
    await flush();
    ensureCanvasEngines(root, { loaders: load });
    await flush();
    expect(document.head.querySelectorAll('script[data-ck-engine="scene"]')).toHaveLength(1);
    expect(document.head.querySelector('script[data-ck-engine="scene"]')?.textContent).toBe('/* scene */');
    expect(document.head.querySelectorAll('script[data-ck-engine="timeline"]')).toHaveLength(1);
    expect(document.head.querySelector('script[data-ck-engine="lottie"]')).toBeNull();
    // The text is loaded once per loader, not once per call.
    expect(load.scene).toHaveBeenCalledTimes(1);
    expect(load.lottie).not.toHaveBeenCalled();
  });

  it('injects into the frame document, so the engine registers in the frame realm', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const inner = frame.contentDocument!;
    const root = host('<div data-ck-lottie="" data-ck-src="https://a.example/x.json"></div>', inner);
    ensureCanvasEngines(root, { loaders: loaders() });
    await flush();
    expect(inner.head.querySelector('script[data-ck-engine="lottie"]')).not.toBeNull();
    expect(document.head.querySelector('script[data-ck-engine]')).toBeNull();
    frame.remove();
  });

  it('is cancelled by a dispose before the import resolves', async () => {
    let resolve: (text: string) => void = () => undefined;
    const slow: EngineLoader = () =>
      new Promise((done) => {
        resolve = done;
      });
    const dispose = ensureCanvasEngines(host('<div data-ck-scene="particles"></div>'), { loaders: { scene: slow } });
    dispose();
    resolve('/* late */');
    await flush();
    expect(document.querySelector('script[data-ck-engine]')).toBeNull();
  });

  it('loads nothing under reduced motion, or without a marker', async () => {
    const load = loaders();
    ensureCanvasEngines(host('<p data-ck-behavior="reveal">x</p>'), { loaders: load });
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    ensureCanvasEngines(host('<div data-ck-scene="particles"></div>'), { loaders: load });
    await flush();
    expect(load.scene).not.toHaveBeenCalled();
    expect(document.querySelector('script[data-ck-engine]')).toBeNull();
  });

  describe('the full pixi.js bundle (free-code mode, 2026-10-09)', () => {
    const scripted = (code: string) => {
      const el = host('<div data-ck-custom-code=""></div>').firstElementChild as HTMLElement;
      el.setAttribute('data-ck-js', code);
      return el;
    };

    it('is injected for a region whose code names Pixi — the region itself carries the marker', async () => {
      const pixi = vi.fn<EngineLoader>(() => Promise.resolve('/* pixi */'));
      ensureCanvasEngines(scripted('const { app } = await ck.stage();'), { loaders: { pixi } });
      await flush();
      expect(document.head.querySelector('script[data-ck-engine="pixi"]')?.textContent).toBe('/* pixi */');
      expect(pixi).toHaveBeenCalledTimes(1);
    });

    it('is not loaded for a script that never mentions Pixi', async () => {
      const pixi = vi.fn<EngineLoader>(() => Promise.resolve('/* pixi */'));
      ensureCanvasEngines(scripted('ck.root.title = "x"'), { loaders: { pixi } });
      await flush();
      expect(pixi).not.toHaveBeenCalled();
      expect(document.querySelector('script[data-ck-engine]')).toBeNull();
    });

    it('is the one engine that loads under reduced motion: the script asked for it by name', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
      const load = loaders();
      const pixi = vi.fn<EngineLoader>(() => Promise.resolve('/* pixi */'));
      const root = host('<div data-ck-scene="particles"></div>');
      root.firstElementChild?.setAttribute('data-ck-js', 'await ck.pixi()');
      ensureCanvasEngines(root, { loaders: { ...load, pixi } });
      await flush();
      expect(document.head.querySelector('script[data-ck-engine="pixi"]')).not.toBeNull();
      expect(load.scene).not.toHaveBeenCalled();
      expect(document.head.querySelector('script[data-ck-engine="scene"]')).toBeNull();
    });
  });
});

describe('ENGINE_LOADERS', () => {
  it('build the asset texts: banner + source + runner call; the scene bundle as it is', async () => {
    const [timeline, lottie, scene] = await Promise.all([
      ENGINE_LOADERS.timeline(),
      ENGINE_LOADERS.lottie(),
      ENGINE_LOADERS.scene(),
    ]);
    const { TIMELINE_BANNER, TIMELINE_SOURCE } = await import('./timeline-source');
    const { LOTTIE_BANNER } = await import('./lottie-source');
    const { SCENE_SOURCE } = await import('./scene-source');
    expect(timeline.startsWith(TIMELINE_BANNER + TIMELINE_SOURCE)).toBe(true);
    expect(timeline).toMatch(/;\(function installTimelineEngine\([\s\S]*\)\(window\);\n$/u);
    expect(lottie.startsWith(LOTTIE_BANNER)).toBe(true);
    expect(lottie).toMatch(/;\(function installLottieEngine\([\s\S]*\)\(window\);\n$/u);
    expect(scene).toBe(SCENE_SOURCE);
  });

  it('carries the full pixi.js bundle as it is (banner and self-install included)', async () => {
    const { PIXI_FULL_SOURCE } = await import('./pixi-full-source');
    expect(await ENGINE_LOADERS.pixi()).toBe(PIXI_FULL_SOURCE);
  });
});

/* ── the engine sources never reach the editor's main chunk ── */

const SRC = join(process.cwd(), 'src');
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s(?:[^;'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gu;
const ENGINE_SOURCE = /engines\/(?:timeline|scene|lottie|pixi-full)-source\.ts$/u;

function resolveImport(from: string, specifier: string): string | undefined {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (candidate.endsWith('.ts') || candidate.endsWith('.tsx')) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop() ?? '';
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(STATIC_IMPORT)) {
      const specifier = match[1] ?? '';
      if (!specifier.startsWith('.')) continue;
      const next = resolveImport(file, specifier);
      if (next !== undefined) stack.push(next);
    }
  }
  return seen;
}

describe('engine sources are dynamic imports only', () => {
  it('renderer/src/index.ts never statically reaches an engine source', () => {
    const graph = staticGraph(join(SRC, 'index.ts'));
    expect(graph.has(join(SRC, 'engines/inject.ts'))).toBe(true);
    expect(graph.has(join(SRC, 'export/export-static-site.ts'))).toBe(true);
    expect([...graph].filter((file) => ENGINE_SOURCE.test(file))).toEqual([]);
  });

  it('inject.ts and the exporter name each source in a dynamic import()', () => {
    const inject = readFileSync(join(SRC, 'engines/inject.ts'), 'utf8');
    const exporter = readFileSync(join(SRC, 'export/export-static-site.ts'), 'utf8');
    // free-code mode (2026-10-09): the full pixi.js bundle is a dynamic import too.
    for (const kind of ['timeline', 'scene', 'lottie', 'pixi-full']) {
      expect(inject).toContain(`import('./${kind}-source')`);
      expect(exporter).toContain(`import('../engines/${kind}-source')`);
    }
  });
});
