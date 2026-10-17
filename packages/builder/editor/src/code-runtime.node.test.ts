import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { composeManagedCatalog } from './code-runtime';

describe('app-facing code runtime doors', () => {
  it('composes a validated, detached managed catalog port', () => {
    const source = { language: 'js' as const, source: 'export const value = 1' };
    const catalog = composeManagedCatalog({
      manifest: {
        catalogVersion: 'catalog-1',
        runtimeProfile: 'craftkit-react-v1',
        packages: [
          {
            packageId: 'react',
            version: '19.2.8',
            importSpecifiers: ['react'],
            sourceArtifactId: 'react-19.2.8',
            cssArtifactIds: [],
            license: 'MIT',
            integrity: 'sha256-test',
          },
        ],
      },
      modules: { react: source },
      stylesheets: ['/* base */', '', '/* components */'],
    });

    expect(catalog.modules['react']).toEqual(source);
    expect(catalog.modules['react']).not.toBe(source);
    expect(catalog.stylesheet).toBe('/* base */\n/* components */');
  });

  it('keeps browser and compiler entrypoints physically separate', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { exports: Record<string, string> };
    const browser = readFileSync(resolve(process.cwd(), 'src/code-runtime.browser.ts'), 'utf8');

    expect(manifest.exports['./code-runtime/browser']).toBe('./src/code-runtime.browser.ts');
    expect(manifest.exports['./code-runtime/compiler']).toBe('./src/code-runtime.compiler.ts');
    expect(browser).not.toMatch(/code-runtime\/compiler/u);
    expect(browser).not.toMatch(/\besbuild\b/u);
  });
});
