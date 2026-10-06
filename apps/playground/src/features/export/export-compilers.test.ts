// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  defaultDesignSystem,
  type BuilderDocument,
  type BuilderSite,
} from '@craftkit/builder';

import { exportCompilers, namedStyleClasses, PublishCompileError } from './export-compilers';

function documentWith(tree: unknown): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'x' }, slots: { default: ['cc'] } },
      cc: { id: 'cc', type: 'customCode', props: { tree: tree as never }, slots: {} },
    },
  };
}

const tree = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'h1', className: 'text-4xl ck-s-card', text: 'مرحبا' }],
};

function siteWith(options: { classes: boolean; styles?: Record<string, string> }): BuilderSite {
  const styles = Object.fromEntries(
    Object.entries(options.styles ?? {}).map(([id, className]) => [id, { id, name: id, className }]),
  );
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'rtl',
    pages: [
      {
        id: 'home',
        address: '/',
        title: 'Home',
        purpose: '',
        audience: '',
        document: options.classes ? documentWith(tree) : documentWith({ kind: 'root', children: [] }),
        regions: [],
      },
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
    ...(options.styles === undefined ? {} : { library: { styles } }),
  };
}

const anyDocument = documentWith({ kind: 'root', children: [] });

describe('export compilers (never silently drop classes)', () => {
  it('compiles every rendered utility, registered blocks and named styles included, and skips hooks', async () => {
    const compileFor = vi.fn((names: Iterable<string>) => Promise.resolve(`/*${[...names].join(' ')}*/`));
    const site = siteWith({ classes: true, styles: { card: 'p-6 rounded-xl text-4xl' } });
    expect([...namedStyleClasses(site)]).toEqual(['p-6', 'rounded-xl', 'text-4xl']);
    const compilers = exportCompilers({ site, liveSheet: '.text-4xl{}', compiler: { compileFor } });
    // The scoped live sheet would only duplicate the one coherent compile.
    await expect(compilers.compileCss(anyDocument)).resolves.toBe('');
    const css = await compilers.compileClasses?.([
      'text-4xl',
      'p-6',
      'py-section-lg',
      'bg-accent',
      'ck-s-card',
      'ck-fx-glass',
      'bldr-x',
      'group',
    ]);
    expect(compileFor).toHaveBeenCalledWith(['text-4xl', 'p-6', 'py-section-lg', 'bg-accent']);
    expect(css).toBe('/*text-4xl p-6 py-section-lg bg-accent*/');
  });

  it('refuses to publish when neither the live sheet nor a compiler is available', () => {
    expect(() => exportCompilers({ site: siteWith({ classes: true }), liveSheet: '  ', compiler: undefined })).toThrow(
      PublishCompileError,
    );
  });

  it('without a compiler, refuses as soon as a page renders a class the live sheet does not hold', async () => {
    const compilers = exportCompilers({ site: siteWith({ classes: true }), liveSheet: '.text-4xl{}', compiler: undefined });
    await expect(compilers.compileCss(anyDocument)).resolves.toBe('.text-4xl{}');
    await expect(compilers.compileClasses?.(['text-4xl', 'ck-s-card'])).resolves.toBe('');
    await expect(compilers.compileClasses?.(['text-4xl', 'py-section-lg'])).rejects.toThrow(PublishCompileError);
  });

  it('refuses when the compile fails, naming the reason', async () => {
    const compileFor = vi.fn(() => Promise.reject(new Error('tailwind exploded')));
    const compilers = exportCompilers({ site: siteWith({ classes: true }), liveSheet: '', compiler: { compileFor } });
    await expect(compilers.compileClasses?.(['text-4xl'])).rejects.toThrow(/could not be compiled/u);
  });

  it('needs no compiler at all when nothing rendered carries a class', async () => {
    const compilers = exportCompilers({ site: siteWith({ classes: false }), liveSheet: '', compiler: undefined });
    await expect(compilers.compileClasses?.([])).resolves.toBe('');
    await expect(compilers.compileCss(anyDocument)).resolves.toBe('');
  });
});
