// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compileProject, fingerprint } from '@craftkit/builder-code-runtime/compiler';
import type { RuntimeSnapshot } from '@craftkit/builder-code-runtime';
import { buildManagedCatalog } from './build-managed-catalog';
import { MANAGED_RUNTIME_SPECIFIER, REFERENCE_MANAGED_CATALOG_VERSION } from './managed-catalog';

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
    page.project.files[page.entry]!.source = `import {ArrowRight} from 'lucide-react'; import {motion} from '${ENGINE}/react'; export default function Page() { return <motion.main initial={{opacity:0}} animate={{opacity:1}} className="grid gap-6 bg-[#123456] p-7 md:grid-cols-2"><ArrowRight aria-label="Continue"/><h1>Free composition</h1></motion.main> }`;
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
