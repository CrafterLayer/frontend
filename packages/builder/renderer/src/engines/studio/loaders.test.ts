import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { STUDIO_LIB_KEYS } from '../../studio/contract';
import { ensureCanvasEngines, type EngineLoader } from '../inject';
import { STUDIO_ENGINE_LOADERS, studioAssetFile } from './loaders';

/*
  pixi-studio:runtime-wiring (2026-10-10): the lazily loaded Studio assets (DESIGN §B.1) and how
  the editor canvas / a host Preview injects them (`inject.ts`).
*/

const flush = () => new Promise((done) => setTimeout(done, 0));

function scripted(code: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = '<div data-ck-custom-code=""></div>';
  document.body.appendChild(host);
  const el = host.firstElementChild as HTMLElement;
  el.setAttribute('data-ck-js', code);
  return el;
}

function fakeLoaders() {
  return {
    pixi: vi.fn<EngineLoader>(() => Promise.resolve('/* pixi */')),
    'lib-kit': vi.fn<EngineLoader>(() => Promise.resolve('/* kit */')),
    'lib-filters': vi.fn<EngineLoader>(() => Promise.resolve('/* filters */')),
    'lib-physics': vi.fn<EngineLoader>(() => Promise.resolve('/* physics */')),
    sound: vi.fn<EngineLoader>(() => Promise.resolve('/* sound */')),
  };
}

const injected = () =>
  Array.from(document.head.querySelectorAll('script[data-ck-engine]')).map((script) =>
    script.getAttribute('data-ck-engine'),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('STUDIO_ENGINE_LOADERS', () => {
  it('has one loader per library key plus sound, and names each asset file', () => {
    expect(Object.keys(STUDIO_ENGINE_LOADERS).sort()).toEqual(
      [...STUDIO_LIB_KEYS.map((key) => `lib-${key}`), 'sound'].sort(),
    );
    expect(studioAssetFile('lib-filters')).toBe('ck-lib-filters.js');
    expect(studioAssetFile('sound')).toBe('ck-sound.js');
  });

  it('reaches every generated module through a dynamic import() only', () => {
    const text = readFileSync(join(process.cwd(), 'src/engines/studio/loaders.ts'), 'utf8');
    for (const key of [...STUDIO_LIB_KEYS, 'sound']) expect(text).toContain(`import('./${key}-source')`);
    expect(text).not.toMatch(/^\s*import\s[^(]*['"]\.\/[a-z]+-source['"]/mu);
  });
});

describe('ensureCanvasEngines — Studio assets', () => {
  it('injects pixi, the kit and the named libraries for ck.scene({ libs })', async () => {
    const load = fakeLoaders();
    ensureCanvasEngines(scripted("const s = await ck.scene({ libs: ['filters'] });"), { loaders: load });
    await flush();
    expect(injected().sort()).toEqual(['lib-filters', 'lib-kit', 'pixi']);
    expect(load['lib-physics']).not.toHaveBeenCalled();
    expect(load.sound).not.toHaveBeenCalled();
  });

  it('loads the libraries under reduced motion too (the script decides what to draw)', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const load = fakeLoaders();
    ensureCanvasEngines(scripted("await ck.use('physics');"), { loaders: load });
    await flush();
    expect(injected()).toEqual(['lib-physics']);
  });

  it('never loads sound on the editor canvas (the default), only in a Preview', async () => {
    const load = fakeLoaders();
    ensureCanvasEngines(scripted("ck.sound.play('pop');"), { loaders: load });
    await flush();
    expect(load.sound).not.toHaveBeenCalled();
    expect(injected()).toEqual([]);

    const preview = fakeLoaders();
    ensureCanvasEngines(scripted("ck.sound.play('pop');"), { loaders: preview, canvas: false });
    await flush();
    expect(injected()).toEqual(['sound']);
  });

  it('loads sound for a data-ck-sound element in a Preview', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<button data-ck-sound="click:pop">Go</button>';
    document.body.appendChild(host);
    const load = fakeLoaders();
    ensureCanvasEngines(host, { loaders: load, canvas: false });
    await flush();
    expect(injected()).toEqual(['sound']);
  });
});
