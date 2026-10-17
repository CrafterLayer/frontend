import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import type { ManagedCatalog, RuntimeSnapshot } from '../contracts';
import { COMPILER_VERSION } from '../fingerprint';
import { compileProject } from './compile-project';

const require = createRequire(import.meta.url);

/** A catalog shaped like the real one: Tailwind's theme and the utilities layer, no extras. */
const catalog: ManagedCatalog = {
  manifest: {
    catalogVersion: 'test-1',
    runtimeProfile: 'craftkit-react-v1',
    packages: [
      {
        packageId: 'react',
        version: '19.2.8',
        importSpecifiers: ['react', 'react/jsx-runtime'],
        sourceArtifactId: 'react',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'test',
      },
      {
        packageId: 'react-dom',
        version: '19.2.8',
        importSpecifiers: ['react-dom/client'],
        sourceArtifactId: 'react-dom',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'test',
      },
    ],
  },
  modules: {
    react: { language: 'js', source: 'export function createElement(){return null}' },
    'react/jsx-runtime': {
      language: 'js',
      source: 'export function jsx(){return null};export const jsxs=jsx;',
    },
    'react-dom/client': {
      language: 'js',
      source: 'export function createRoot(){return {render(){}}};export function hydrateRoot(){}',
    },
  },
  stylesheet: `@layer theme, base, components, utilities;\n@layer theme {${readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8')}}\n@layer utilities { @tailwind utilities; }`,
};

function snapshot(source: string, css?: string): RuntimeSnapshot {
  return {
    projectId: 'project',
    pageId: 'home',
    address: '/',
    entry: 'pages/home/Page.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: 'r1',
      dependencyLock: {
        catalogVersion: 'test-1',
        packages: { react: '19.2.8', 'react-dom': '19.2.8' },
      },
      files: {
        'pages/home/Page.tsx': { language: 'tsx', source },
        ...(css === undefined ? {} : { 'pages/home/page.css': { language: 'css', source: css } }),
      },
    },
  };
}

describe('the Tailwind plugins a code page compiles with', () => {
  it('styles prose and form-* classes, and resets no input the page did not mark', async () => {
    const result = await compileProject(
      snapshot(
        'export default function Page(){return <main><article className="prose md:prose-lg"><h2>Story</h2></article><input className="form-input" /><input type="checkbox" /></main>}',
      ),
      { catalog },
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const css = result.artifact.css.map((file) => file.content).join('\n');
    expect(css).toContain('.prose {');
    expect(css).toContain('.md\\:prose-lg {');
    expect(css).toContain('.form-input {');
    expect(css).not.toMatch(/input:where\(\[type=/u);
  });

  it('still refuses a plugin or config module the authored CSS names', async () => {
    const result = await compileProject(
      snapshot(
        'import "./page.css"; export default function Page(){return <main/>}',
        '@plugin "./evil.js";',
      ),
      { catalog },
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.diagnostics[0]?.message).toContain(
        'Authored Tailwind plugins and configuration modules are not allowed.',
      );
    }
  });

  it('names the installed plugin versions in the compiler identity', () => {
    for (const name of ['@tailwindcss/typography', '@tailwindcss/forms']) {
      const { version, license } = JSON.parse(
        readFileSync(require.resolve(`${name}/package.json`), 'utf8'),
      ) as { version: string; license: string };
      expect(COMPILER_VERSION).toContain(`${name.slice('@tailwindcss/'.length)}-${version}`);
      expect(license).toBe('MIT');
    }
  });
});
