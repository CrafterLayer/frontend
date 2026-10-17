// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import {
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  defaultDesignSystem,
  type BuilderDocument,
  type BuilderSite,
  type SitePage,
} from '@craftkit/builder';

import { createArtifactArchive } from '../preview/artifact-archive';
import { createReferenceCodePageFixture } from '../preview/code-page-fixture';

import {
  hasStaticPages,
  liveUtilitiesCompileCss,
  publishStaticSite,
  staticSiteOptions,
} from './publish-static-site';

function doc(id: string, props: BuilderDocument['nodes'][string]['props']): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'rtl',
    rootId: id,
    nodes: { [id]: { id, type: 'page', props, slots: { default: [] } } },
  };
}

function page(id: string, address: string, title: string): SitePage {
  return {
    id,
    address,
    title,
    purpose: `${title} — وصف الصفحة`,
    audience: 'زبائن',
    document: doc(`root-${id}`, { title, description: `${title} وصف`, lang: 'ar' }),
    regions: ['header'],
  };
}

function site(pages: SitePage[]): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'rtl',
    pages,
    sharedRegions: {
      header: { id: 'header', kind: 'header', document: doc('header-root', { title: '' }) },
    },
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

// Renders only the page root, so no registry is needed.
const blocks = () => undefined;

describe('publish static site', () => {
  it('builds exporter options from the live site: canvas pages only, shared regions, theme, origin', () => {
    const code = createReferenceCodePageFixture({ address: '/code' }).page;
    const input = site([page('home', '/', 'الرئيسية'), page('menu', '/قائمة-الطعام', 'القائمة'), code]);
    expect(hasStaticPages(input)).toBe(true);
    const compileCss = vi.fn(() => Promise.resolve(''));
    const options = staticSiteOptions(input, {
      blocks,
      compileCss,
      origin: ' https://example.com ',
    });
    expect(options.pages.map(({ address }) => address)).toEqual(['/', '/قائمة-الطعام']);
    expect(options.pages[0]?.before).toHaveLength(1);
    expect(options.pages[0]?.title).toBe('الرئيسية');
    expect(options.origin).toBe('https://example.com');
    expect(options.theme).toBeDefined();
    expect(hasStaticPages(site([code]))).toBe(false);
  });

  it('publishes zip-ready files with a stub compileCss and refuses a code-only site', async () => {
    const compileCss = vi.fn(() => Promise.resolve('.x{color:red}'));
    const files = await publishStaticSite(
      site([page('home', '/', 'الرئيسية'), page('menu', '/قائمة-الطعام', 'القائمة')]),
      { blocks, compileCss, origin: 'https://example.com' },
    );
    const paths = files.map(({ path }) => path);
    expect(paths).toContain('index.html');
    expect(paths).toContain('قائمة-الطعام/index.html');
    expect(paths).toContain('404.html');
    expect(paths).toContain('sitemap.xml');
    expect(paths).toContain('robots.txt');
    expect(compileCss).toHaveBeenCalled();
    const home = files.find(({ path }) => path === 'index.html')?.content ?? '';
    expect(home).toContain('lang="ar"');
    expect(home).toContain('dir="rtl"');
    for (const file of files) expect(Object.keys(file).sort()).toEqual(['content', 'path']);
    const code = createReferenceCodePageFixture().page;
    await expect(publishStaticSite(site([code]), { blocks, compileCss })).rejects.toThrow(
      /no canvas pages/u,
    );
  });

  it('reads CSS from the live-utilities sheet rather than starting a second compiler', async () => {
    const host = {
      querySelector: vi.fn(() => ({ textContent: '@layer utilities{.p-4{padding:1rem}}' })),
    };
    const compile = liveUtilitiesCompileCss(host);
    await expect(compile(doc('r', {}))).resolves.toContain('.p-4');
    expect(host.querySelector).toHaveBeenCalledWith('style[data-ck-live-utilities]');
    const empty = liveUtilitiesCompileCss({ querySelector: () => null });
    await expect(empty(doc('r', {}))).resolves.toBe('');
  });

  it('zips an uploaded picture with its bytes, not as an empty file', async () => {
    // A 1x1 PNG, the shape an upload takes (FileReader.readAsDataURL).
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const compileCss = vi.fn(() =>
      Promise.resolve(`.hero{background-image:url(data:image/png;base64,${png})}`),
    );
    const files = await publishStaticSite(site([page('home', '/', 'الرئيسية')]), {
      blocks,
      compileCss,
    });
    const picture = files.find(({ path }) => path.startsWith('assets/images/'));
    expect(picture?.path).toMatch(/\.png$/u);
    expect(picture?.bytes?.length).toBeGreaterThan(0);
    const directory = await mkdtemp(join(tmpdir(), 'craftkit-publish-'));
    try {
      const zip = join(directory, 'site.zip');
      await writeFile(zip, createArtifactArchive(files));
      await promisify(execFile)('unzip', ['-qq', zip, '-d', join(directory, 'site')]);
      const unpacked = await readFile(join(directory, 'site', picture?.path ?? 'missing'));
      expect(unpacked.length).toBeGreaterThan(0);
      expect(Buffer.compare(unpacked, Buffer.from(png, 'base64'))).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
