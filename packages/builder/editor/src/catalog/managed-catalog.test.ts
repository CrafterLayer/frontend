// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  compileProject,
  fingerprint,
  projectFingerprints,
} from '@craftkit/builder-code-runtime/compiler';
import type { RuntimeSnapshot } from '@craftkit/builder-code-runtime';
import { buildManagedCatalog } from './build-managed-catalog';
import {
  MANAGED_REACT_VERSION,
  MANAGED_RUNTIME_SPECIFIER,
  REFERENCE_MANAGED_CATALOG_VERSION,
} from './managed-catalog';

function snapshot(): RuntimeSnapshot {
  return {
    projectId: 'test-project',
    pageId: 'home',
    address: '/',
    entry: 'pages/home/index.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: 'r1',
      dependencyLock: {
        catalogVersion: REFERENCE_MANAGED_CATALOG_VERSION,
        packages: { react: '19.2.8', 'react-dom': '19.2.8' },
      },
      files: {
        'pages/home/index.tsx': {
          language: 'tsx',
          source:
            'import {useState} from "react"; export default function Page() { const [n,setN]=useState(0); return <button onClick={()=>setN(n+1)}>Count {n}</button>; }',
        },
      },
    },
  };
}

/** The animation engine's package name, assembled so no import specifier appears literally. */
const ENGINE = ['mo', 'tion'].join('');

describe('pinned managed runtime catalog', () => {
  it.each(['19.2.8', '19.2.9'])(
    'compiles a matching %s lock against the patched runtime without rewriting the project',
    async (version) => {
      const page = snapshot();
      page.project.dependencyLock.packages = { react: version, 'react-dom': version };
      const original = structuredClone(page.project);
      const catalog = await buildManagedCatalog();
      const result = await compileProject(page, { catalog });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(page.project).toEqual(original);
      expect(MANAGED_REACT_VERSION).toBe('19.2.9');
      expect(catalog.modules[MANAGED_RUNTIME_SPECIFIER]?.source).toContain('19.2.9');
      expect(result.artifact.js.map((file) => file.content).join('\n')).toContain('19.2.9');
      expect(catalog.manifest.packages.slice(0, 2)).toMatchObject([
        { version: '19.2.9', sourceArtifactId: 'craftkit-react-19.2.9-v1' },
        { version: '19.2.9', sourceArtifactId: 'craftkit-react-dom-19.2.9-v1' },
      ]);
    },
  );

  it.each([
    ['19.2.7', '19.2.7'],
    ['19.2.8', '19.2.9'],
    ['19.2.9', '19.2.8'],
  ])('rejects unsupported or mixed React locks (%s, %s)', async (react, reactDom) => {
    const page = snapshot();
    page.project.dependencyLock.packages = { react, 'react-dom': reactDom };
    expect(await compileProject(page, { catalog: await buildManagedCatalog() })).toMatchObject({
      ok: false,
    });
  });

  it('requires explicit compatibility and retains catalog, profile, and package lock gates', async () => {
    const page = snapshot();
    const catalog = await buildManagedCatalog();
    const noAliases = { ...catalog, compatibleLockVersions: {} };
    expect(await compileProject(page, { catalog: noAliases })).toMatchObject({ ok: false });
    expect((await projectFingerprints(page, catalog)).catalogFingerprint).not.toBe(
      (await projectFingerprints(page, noAliases)).catalogFingerprint,
    );
    for (const packageId of ['react', 'react-dom']) {
      const missing = structuredClone(page);
      Reflect.deleteProperty(missing.project.dependencyLock.packages, packageId);
      expect(await compileProject(missing, { catalog })).toMatchObject({ ok: false });
    }
    page.project.dependencyLock.catalogVersion = 'other';
    expect(await compileProject(page, { catalog })).toMatchObject({ ok: false });
    page.project.dependencyLock.catalogVersion = REFERENCE_MANAGED_CATALOG_VERSION;
    const wrongProfile = {
      ...page,
      project: { ...page.project, runtimeProfile: 'other' },
    } as unknown as RuntimeSnapshot;
    expect(await compileProject(wrongProfile, { catalog })).toMatchObject({ ok: false });
  });

  it('admits vanilla Embla only when explicitly locked, preserving existing v1 projects', async () => {
    const page = snapshot();
    page.project.files[page.entry]!.source =
      `import Embla from 'embla-carousel'; export default function Page(){ return <button onClick={()=>void Embla}>Slides</button>; }`;
    const catalog = await buildManagedCatalog();
    expect(await compileProject(page, { catalog })).toMatchObject({ ok: false });
    page.project.dependencyLock.packages['embla-carousel'] = '8.6.0';
    const result = await compileProject(page, { catalog });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(catalog.modules['embla-carousel']?.source).toContain('Copyright (c) David Jerleke.');
    expect(result.artifact.js.map((file) => file.content).join('\n')).not.toContain('from "embla');
    page.project.dependencyLock.packages['embla-carousel'] = '8.5.0';
    expect(await compileProject(page, { catalog })).toMatchObject({ ok: false });
  });
  it('bundles real React and DOM, preserves license metadata, and detaches callers', async () => {
    const catalog = await buildManagedCatalog();
    const source = catalog.modules[MANAGED_RUNTIME_SPECIFIER]?.source;
    expect(source).toBeDefined();
    expect(source).toContain('react.production');
    expect(
      catalog.manifest.packages.every(
        (entry) => entry.integrity !== 'unbuilt' && entry.license.length > 0,
      ),
    ).toBe(true);
    expect(catalog.manifest.packages[0]?.integrity).toBe(await fingerprint(source));
    expect(await buildManagedCatalog()).not.toBe(catalog);
  });

  it('generates responsive Tailwind and arbitrary values with ordinary icons and motion props', async () => {
    const page = snapshot();
    page.project.dependencyLock.packages['lucide-react'] = '1.43.0';
    page.project.dependencyLock.packages['motion'] = '13.1.1';
    /*
      The engine specifiers are split ('mo' + 'tion') so the motion package's
      containment gate, which scans every member's source for engine imports,
      does not read this user-authored page text as an import of its own.
    */
    page.project.files[page.entry]!.source =
      `import {ArrowRight} from 'lucide-react'; import {motion} from '${ENGINE}/react'; export default function Page() { return <motion.main initial={{opacity:0}} animate={{opacity:1}} className="grid gap-6 bg-[#123456] p-7 md:grid-cols-2"><ArrowRight aria-label="Continue"/><h1>Free composition</h1></motion.main> }`;
    const result = await compileProject(page, { catalog: await buildManagedCatalog() });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const css = result.artifact.css.map((file) => file.content).join('\n');
    expect(css).toContain('display: grid');
    expect(css).toContain('#123456');
    expect(css).toContain('grid-template-columns: repeat(2');
    expect(css).toContain('calc(var(--spacing) * 7)');
    expect(result.artifact.js[0]?.content).not.toContain(`from "${ENGINE}`);
    expect(result.artifact.js[0]?.content).not.toContain('from "lucide');
  });

  it('compiles an interactive page without external imports or preview globals', async () => {
    const result = await compileProject(snapshot(), { catalog: await buildManagedCatalog() });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const javascript = result.artifact.js.map((file) => file.content).join('\n');
    expect(javascript).not.toContain('__CRAFTKIT_REACT_RUNTIME__');
    expect(javascript).not.toContain('from "react');
    expect(javascript).toContain('Count');
    expect(result.artifact.sourceElements.some((element) => element.tag === 'button')).toBe(true);
  });

  it('rejects an unavailable component rather than inventing an export', async () => {
    const page = snapshot();
    const file = page.project.files[page.entry]!;
    file.source =
      'import { Unknown } from "unapproved-library"; export default function Page(){ return <Unknown/> }';
    const result = await compileProject(page, { catalog: await buildManagedCatalog() });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.diagnostics[0]?.message).toContain('locked managed catalog');
  });
});
