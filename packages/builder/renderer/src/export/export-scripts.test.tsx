/*
  Free-code mode (2026-10-09): a region's `js` in a static export.

  The code rides on the region as `data-ck-js` (never a `<script>`), so the existing behaviours
  runtime carries it: `ck-behaviors.js` gains the `scripts` pack on a site whose markup has the
  attribute, and the FULL pixi.js bundle (`assets/ck-pixi.js` + its locator link) only when some
  page's code names Pixi.
*/
import { describe, expect, it } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  LATEST_SCHEMA_VERSION,
  type BlockRenderProps,
  type BuilderDocument,
  type JsonValue,
  type RegisteredBlock,
} from '@craftkit/builder-schema';

import { CustomCode } from '../components/CustomCode';
import { exportStaticSite } from './export-static-site';

const anySchema =
  (fixtureBlocks.contributes?.blocks ?? []).find(({ schema }) => schema.type === 'hero')?.schema ??
  raise();

function raise(): never {
  throw new Error('Fixture is missing the "hero" block.');
}

function PageRoot({ slots }: BlockRenderProps) {
  return <main>{slots['default']}</main>;
}

/** The customCode block's render, minus the extension: tree + the region's own script. */
function Code({ node }: BlockRenderProps) {
  const js = node.props['js'];
  return (
    <CustomCode
      hostId={node.id}
      tree={node.props['tree']}
      js={typeof js === 'string' ? js : undefined}
    />
  );
}

const registry: Record<string, RegisteredBlock> = {
  page: { schema: anySchema, render: PageRoot as NonNullable<RegisteredBlock['render']> },
  code: { schema: anySchema, render: Code as NonNullable<RegisteredBlock['render']> },
};

const TREE: JsonValue = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'p', text: 'Hello' }],
};

function page(props: Record<string, JsonValue>): BuilderDocument {
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
        slots: { default: ['s'] },
      },
      s: { id: 's', type: 'code', props: { tree: TREE, ...props } },
    },
  };
}

async function exportPages(pages: { address: string; document: BuilderDocument }[]) {
  const { files } = await exportStaticSite({
    pages: pages.map(({ address, document }, at) => ({
      pageId: `p${String(at)}`,
      address,
      document,
    })),
    blocks: (type: string) => registry[type],
    compileCss: () => Promise.resolve(''),
  });
  return {
    file: (path: string) => files.find((candidate) => candidate.path === path)?.content,
    paths: files.map((candidate) => candidate.path),
  };
}

const PIXI_LINK = '<link rel="ck-engine" href="assets/ck-pixi.js" data-ck-engine="pixi">';

describe('exportStaticSite — region scripts', () => {
  it('ships the scripts pack, and NO pixi bundle, for a script that does not use Pixi', async () => {
    const { file, paths } = await exportPages([
      { address: '/', document: page({ js: "ck.root.style.outline = '1px solid';" }) },
    ]);
    const home = file('index.html') ?? '';

    expect(home).toContain('data-ck-js="ck.root.style.outline = &#x27;1px solid&#x27;;"');
    expect(home).toContain('data-ck-js-id="s"');
    expect(home).toContain('<script defer src="assets/ck-behaviors.js"></script>');
    expect(file('assets/ck-behaviors.js')).toContain('function mountScripts(');
    expect(paths).not.toContain('assets/ck-pixi.js');
    expect(home).not.toContain('data-ck-engine="pixi"');
  });

  it('emits assets/ck-pixi.js and its locator link when the code calls ck.stage()', async () => {
    const { PIXI_FULL_SOURCE } = await import('../engines/pixi-full-source');
    const { file, paths } = await exportPages([
      {
        address: '/',
        document: page({ js: 'const { PIXI, app } = await ck.stage({ pointer: true });' }),
      },
    ]);
    const home = file('index.html') ?? '';

    expect(paths).toContain('assets/ck-pixi.js');
    expect(file('assets/ck-pixi.js')).toBe(PIXI_FULL_SOURCE);
    expect(home).toContain(PIXI_LINK);
    expect(file('assets/ck-behaviors.js')).toContain('function mountScripts(');
  });

  it('emits it for ck.pixi() and for any mention of Pixi in the code', async () => {
    for (const js of [
      'const PIXI = await ck.pixi();',
      '// draws with PixiJS\nck.root.title = "x";',
    ]) {
      const { paths } = await exportPages([{ address: '/', document: page({ js }) }]);
      expect(paths).toContain('assets/ck-pixi.js');
    }
  });

  it('ships ONE bundle for the site and links it only from the pages that use it', async () => {
    const { file, paths } = await exportPages([
      { address: '/', document: page({ js: 'ck.root.title = "plain";' }) },
      { address: '/scene', document: page({ js: 'await ck.stage();' }) },
      { address: '/scene-two', document: page({ js: 'await ck.pixi();' }) },
    ]);

    expect(paths.filter((path) => path === 'assets/ck-pixi.js')).toHaveLength(1);
    expect(file('index.html')).not.toContain('data-ck-engine="pixi"');
    expect(file('scene/index.html')).toContain('href="../assets/ck-pixi.js" data-ck-engine="pixi"');
    expect(file('scene-two/index.html')).toContain(
      'href="../assets/ck-pixi.js" data-ck-engine="pixi"',
    );
  });

  it('adds nothing to a site with no script: no scripts pack, no behaviours file at all', async () => {
    const { file, paths } = await exportPages([{ address: '/', document: page({}) }]);

    expect(file('index.html')).not.toContain('data-ck-js');
    expect(paths).not.toContain('assets/ck-behaviors.js');
    expect(paths).not.toContain('assets/ck-pixi.js');
  });

  it('treats a blank script as no script', async () => {
    const { file, paths } = await exportPages([{ address: '/', document: page({ js: '  \n ' }) }]);

    expect(file('index.html')).not.toContain('data-ck-js');
    expect(paths).not.toContain('assets/ck-behaviors.js');
  });

  it('never writes the code as a <script>, and the attribute round-trips through the HTML parser', async () => {
    const code = [
      '// quotes " \' and a closing tag </script><script>alert(1)</script>',
      'const a = "<b>&amp;</b>";',
      'if (a < 3 && a > 1) { await ck.stage(); }',
    ].join('\n');
    const { file } = await exportPages([{ address: '/', document: page({ js: code }) }]);
    const html = file('index.html') ?? '';

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    // The only scripts are the runtime's own `src` scripts and the SEO JSON-LD; none carries the code.
    const inline = [...parsed.querySelectorAll('script')].filter(
      (script) => !script.hasAttribute('src') && script.type !== 'application/ld+json',
    );
    expect(inline).toEqual([]);
    expect(html).not.toContain('<script>alert(1)</script>');
    const region = parsed.querySelector('[data-ck-custom-code]');
    expect(region?.getAttribute('data-ck-js')).toBe(code);
    expect(region?.getAttribute('data-ck-js-id')).toBe('s');
  });
});
