/*
  pixi-studio:runtime-wiring (2026-10-10): the export of Pixi Studio pages (DESIGN §B.1, §G).

  The add-on libraries and the sound engine ship as their own lazy assets
  (`assets/ck-lib-<key>.js`, `assets/ck-sound.js`) ONLY on a site whose code names them; uploaded
  sounds become `assets/sounds/<fnv1a64>.<ext>` only when referenced; the project sound entries a
  page plays are inlined once as `<script type="application/json" data-ck-sound-bank>`.

  The generated source modules are replaced by labelled stand-ins: what is under test is which
  assets ship, not their bytes (studio-sources.test.ts holds those).
*/
import { describe, expect, it, vi } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  LATEST_SCHEMA_VERSION,
  type AssetEntry,
  type BlockRenderProps,
  type BuilderDocument,
  type JsonValue,
  type RegisteredBlock,
  type SiteLibrary,
} from '@craftkit/builder-schema';

import { pageEngines } from '../behaviors/script';
import { CustomCode } from '../components/CustomCode';
import { fnv1a64 } from '../studio/contract';
import { exportStaticSite } from './export-static-site';

vi.mock('../engines/studio/loaders', () => {
  const keys = [
    'kit',
    'filters',
    'emitter',
    'physics',
    'brush',
    'rough',
    'viewport',
    'anim',
    'fx',
    'dialogue',
    'ink',
    'tilemap',
    'audio',
    'gameai',
    'hud',
    'peeps',
  ];
  const loaders: Record<string, () => Promise<string>> = {
    sound: () => Promise.resolve('/* ck-sound stand-in */'),
  };
  for (const key of keys)
    loaders[`lib-${key}`] = () => Promise.resolve(`/* ck-lib-${key} stand-in */`);
  return { STUDIO_ENGINE_LOADERS: loaders, studioAssetFile: (kind: string) => `ck-${kind}.js` };
});

const anySchema =
  (fixtureBlocks.contributes?.blocks ?? []).find(({ schema }) => schema.type === 'hero')?.schema ??
  raise();

function raise(): never {
  throw new Error('Fixture is missing the "hero" block.');
}

function PageRoot({ slots }: BlockRenderProps) {
  return <main>{slots['default']}</main>;
}

function Code({ node }: BlockRenderProps) {
  const js = node.props['js'];
  return (
    <CustomCode
      hostId={node.id}
      tree={node.props['tree']}
      js={typeof js === 'string' ? js : undefined}
      jsParams={node.props['jsParams']}
    />
  );
}

/** A `data-ck-sound` button, rendered as-is (the tree vocabulary for it lives in the schema). */
function SoundButton({ node }: BlockRenderProps) {
  const sound = node.props['sound'];
  return <button data-ck-sound={typeof sound === 'string' ? sound : undefined}>Play</button>;
}

const registry: Record<string, RegisteredBlock> = {
  page: { schema: anySchema, render: PageRoot as NonNullable<RegisteredBlock['render']> },
  code: { schema: anySchema, render: Code as NonNullable<RegisteredBlock['render']> },
  button: { schema: anySchema, render: SoundButton as NonNullable<RegisteredBlock['render']> },
};

const TREE: JsonValue = { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Hello' }] };

function page(blocks: { type: string; props: Record<string, JsonValue> }[]): BuilderDocument {
  const ids = blocks.map((_block, at) => `b${String(at)}`);
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Home', lang: 'en' },
        slots: { default: ids },
      },
      ...Object.fromEntries(
        blocks.map((block, at) => [
          ids[at] ?? '',
          {
            id: ids[at] ?? '',
            type: block.type,
            props: block.type === 'code' ? { tree: TREE, ...block.props } : block.props,
          },
        ]),
      ),
    },
  };
}

const MP3 = `data:audio/mpeg;base64,${btoa('ID3-fake-mp3-bytes')}`;
const OGG = `data:audio/ogg;base64,${btoa('OggS-fake-ogg-bytes')}`;
const WAV = `data:audio/wav;base64,${btoa('RIFF-fake-wav-bytes')}`;

function asset(id: string, url: string): AssetEntry {
  return { id, url, description: id, mood: [], palette: [], alt: '', width: 0, height: 0 };
}

async function exportPages(
  documents: BuilderDocument[],
  extra: { library?: SiteLibrary; assets?: Record<string, AssetEntry> } = {},
) {
  const { files } = await exportStaticSite({
    pages: documents.map((document, at) => ({
      pageId: `p${String(at)}`,
      address: at === 0 ? '/' : `/p${String(at)}`,
      document,
    })),
    blocks: (type: string) => registry[type],
    compileCss: () => Promise.resolve(''),
    ...(extra.library === undefined ? {} : { library: extra.library }),
    ...(extra.assets === undefined ? {} : { assets: extra.assets }),
  });
  return {
    file: (path: string) => files.find((candidate) => candidate.path === path),
    paths: files.map((candidate) => candidate.path),
  };
}

const studioAssets = (paths: string[]) =>
  paths.filter((path) => /^assets\/(?:ck-lib-|ck-sound|ck-pixi|sounds\/)/u.test(path));

describe('Pixi Studio export (§G)', () => {
  it('1. a page with no ck.scene / ck.use / ck.sound / data-ck-sound emits no Studio asset', async () => {
    const plain = await exportPages([
      page([{ type: 'code', props: { js: 'ck.root.title = "x";' } }]),
    ]);
    expect(studioAssets(plain.paths)).toEqual([]);
    const html = plain.file('index.html')?.content ?? '';
    expect(html).not.toContain('data-ck-engine="lib-');
    expect(html).not.toContain('data-ck-sound');
  });

  it("2. ck.scene({ libs: ['filters'] }) emits ck-pixi, ck-lib-kit and ck-lib-filters only", async () => {
    const { paths, file } = await exportPages([
      page([
        {
          type: 'code',
          props: { js: "const s = await ck.scene({ libs: ['filters'] }); s.tick(function () {});" },
        },
      ]),
    ]);
    expect(studioAssets(paths)).toEqual([
      'assets/ck-pixi.js',
      'assets/ck-lib-kit.js',
      'assets/ck-lib-filters.js',
    ]);
    expect(file('assets/ck-lib-filters.js')?.content).toBe('/* ck-lib-filters stand-in */');
    const html = file('index.html')?.content ?? '';
    const locators = [
      ...html.matchAll(/<link rel="ck-engine" href="([^"]+)" data-ck-engine="([^"]+)">/gu),
    ].map((match) => match[2]);
    expect(locators).toEqual(['pixi', 'lib-kit', 'lib-filters']);
    expect(html).toContain(
      '<link rel="ck-engine" href="assets/ck-lib-kit.js" data-ck-engine="lib-kit">',
    );
  });

  it('game libraries (2026-10-12) ship as their own lazy assets, never the sound engine', async () => {
    const js =
      "const s = await ck.scene({ libs: ['tilemap', 'gameai', 'audio', 'hud'] }); s.lib.audio.create(s).sfx('coin');";
    const { paths, file } = await exportPages([page([{ type: 'code', props: { js } }])]);
    expect(studioAssets(paths)).toEqual([
      'assets/ck-pixi.js',
      'assets/ck-lib-kit.js',
      'assets/ck-lib-tilemap.js',
      'assets/ck-lib-audio.js',
      'assets/ck-lib-gameai.js',
      'assets/ck-lib-hud.js',
    ]);
    expect(file('assets/ck-lib-audio.js')?.content).toBe('/* ck-lib-audio stand-in */');
    const html = file('index.html')?.content ?? '';
    expect(html).toContain(
      '<link rel="ck-engine" href="assets/ck-lib-gameai.js" data-ck-engine="lib-gameai">',
    );
    expect(html).not.toContain('data-ck-engine="sound"');
    // Game AI is plain JavaScript: on its own it needs no Pixi at all.
    const ai = await exportPages([
      page([{ type: 'code', props: { js: "await ck.use('gameai');" } }]),
    ]);
    expect(studioAssets(ai.paths)).toEqual(['assets/ck-lib-gameai.js']);
  });

  it('ships each library once for the whole site, and only on the pages that name it', async () => {
    const { paths, file } = await exportPages([
      page([{ type: 'code', props: { js: "await ck.use('physics', 'rough');" } }]),
      page([{ type: 'code', props: { js: "await ck.use('physics');" } }]),
      page([{ type: 'code', props: { js: 'ck.root.title = "plain";' } }]),
    ]);
    expect(studioAssets(paths)).toEqual(['assets/ck-lib-physics.js', 'assets/ck-lib-rough.js']);
    expect(file('p1/index.html')?.content).toContain('data-ck-engine="lib-physics"');
    expect(file('p1/index.html')?.content).not.toContain('data-ck-engine="lib-rough"');
    expect(file('p2/index.html')?.content).not.toContain('data-ck-engine="lib-');
  });

  it('3. sound ships only when used; an uploaded sound only when referenced', async () => {
    const assets = { a1: asset('a1', MP3), a2: asset('a2', OGG) };
    const { paths, file } = await exportPages(
      [page([{ type: 'button', props: { sound: 'click:asset:a1 hover:pop@0.4' } }])],
      { assets },
    );
    const mp3 = `assets/sounds/${fnv1a64(MP3)}.mp3`;
    expect(studioAssets(paths)).toEqual(['assets/ck-sound.js', mp3]);
    expect(Array.from(file(mp3)?.bytes ?? [])).toEqual(
      Array.from(new TextEncoder().encode('ID3-fake-mp3-bytes')),
    );
    const html = file('index.html')?.content ?? '';
    expect(html).toContain(
      '<link rel="ck-engine" href="assets/ck-sound.js" data-ck-engine="sound">',
    );
    // data-ck-sound elements are bound when the engine loads, so the page loads it (deferred).
    expect(html).toContain(
      '<script defer src="assets/ck-sound.js" data-ck-engine="sound"></script>',
    );
    expect(html).toContain(`<link rel="ck-sound-asset" data-ck-sound-asset="a1" href="${mp3}">`);
    expect(html).not.toContain('data-ck-sound-asset="a2"');

    const silent = await exportPages(
      [page([{ type: 'code', props: { js: 'ck.root.title = "x";' } }])],
      { assets },
    );
    expect(studioAssets(silent.paths)).toEqual([]);
  });

  it("a script's ck.sound loads the engine lazily (locator only) and its asset refs ship", async () => {
    const assets = { a1: asset('a1', MP3), a2: asset('a2', OGG) };
    const { paths, file } = await exportPages(
      [
        page([
          {
            type: 'code',
            props: { js: "ck.root.onclick = function () { ck.sound.play('asset:a2'); };" },
          },
        ]),
      ],
      { assets },
    );
    expect(studioAssets(paths)).toEqual([
      'assets/ck-sound.js',
      `assets/sounds/${fnv1a64(OGG)}.ogg`,
    ]);
    const html = file('index.html')?.content ?? '';
    expect(html).toContain('data-ck-engine="sound">');
    expect(html).not.toContain('<script defer src="assets/ck-sound.js"');
  });

  it('4. the project sound entries a page plays are inlined once as the sound bank', async () => {
    const library = {
      sounds: {
        chime: {
          id: 'chime',
          name: { en: 'Chime', ar: 'رنين' },
          source: { kind: 'asset', assetId: 'a3' },
          volume: 0.6,
        },
        other: {
          id: 'other',
          name: { en: 'Other', ar: 'آخر' },
          source: { kind: 'zzfx', params: [1, 0.05] },
          volume: 0.6,
        },
      },
    } as unknown as SiteLibrary;
    const assets = { a3: asset('a3', WAV) };
    const { paths, file } = await exportPages(
      [page([{ type: 'code', props: { js: "ck.sound.play('lib:chime');" } }])],
      { library, assets },
    );
    expect(paths).toContain(`assets/sounds/${fnv1a64(WAV)}.wav`);
    const html = file('index.html')?.content ?? '';
    const bank = /<script type="application\/json" data-ck-sound-bank>([\s\S]*?)<\/script>/u.exec(
      html,
    );
    expect(bank).not.toBeNull();
    const parsed = JSON.parse(bank?.[1] ?? '{}') as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['chime']);
    expect(html.match(/data-ck-sound-bank/gu)).toHaveLength(1);
    expect(html).toContain('data-ck-sound-asset="a3"');
  });

  it('renders jsParams as data-ck-params beside data-ck-js', async () => {
    const { file } = await exportPages([
      page([
        {
          type: 'code',
          props: { js: 'const p = ck.params({ n: 1 });', jsParams: { n: 7, tint: '#ff0000' } },
        },
      ]),
    ]);
    const html = file('index.html')?.content ?? '';
    expect(html).toContain(
      'data-ck-params="{&quot;n&quot;:7,&quot;tint&quot;:&quot;#ff0000&quot;}"',
    );
  });
});

describe('pageEngines — Studio detection', () => {
  it('reads ck.use / ck.scene / ck.sound from markup, DOM and stored JSON alike', () => {
    const code = "const s = await ck.scene({ libs: ['emitter'] }); ck.sound.play('pop');";
    const markup = `<div data-ck-js="${code.replace(/'/gu, '&#x27;')}"></div>`;
    const expected = ['lib-emitter', 'lib-kit', 'pixi', 'sound'];
    expect([...pageEngines(markup)].sort()).toEqual(expected);
    const host = document.createElement('div');
    host.innerHTML = '<div></div>';
    host.firstElementChild?.setAttribute('data-ck-js', code);
    expect([...pageEngines(host)].sort()).toEqual(expected);
    expect([...pageEngines({ attributes: { 'data-ck-js': code } })].sort()).toEqual(expected);
  });

  it('counts a data-ck-sound attribute as sound, but not data-ck-sound-bank', () => {
    expect([...pageEngines('<button data-ck-sound="click:pop">x</button>')]).toEqual(['sound']);
    expect([...pageEngines('<script data-ck-sound-bank>{}</script>')]).toEqual([]);
    expect([...pageEngines({ 'data-ck-sound': 'click:pop' })]).toEqual(['sound']);
  });

  it('keeps the old rule: ck.pixi() / ck.stage() alone is pixi only', () => {
    expect([...pageEngines('<div data-ck-js="await ck.stage();"></div>')]).toEqual(['pixi']);
  });
});
