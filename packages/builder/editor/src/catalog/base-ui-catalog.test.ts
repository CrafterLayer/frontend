// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { compileProject, fingerprint } from '@craftkit/builder-code-runtime/compiler';
import type { RuntimeSnapshot } from '@craftkit/builder-code-runtime';
import { BASE_UI_PARTS, BASE_UI_PACKAGE, BASE_UI_VERSION } from './base-ui-catalog';
import { buildManagedCatalog } from './build-managed-catalog';

function fixture(): RuntimeSnapshot {
  return {
    projectId: 'base',
    pageId: 'home',
    address: '/',
    entry: 'index.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: 'r1',
      dependencyLock: {
        catalogVersion: 'craftkit-managed-reference-v1',
        packages: { react: '19.2.9', 'react-dom': '19.2.9', [BASE_UI_PACKAGE]: BASE_UI_VERSION },
      },
      files: {
        'index.tsx': {
          language: 'tsx',
          source:
            "import {Tabs} from '@base-ui/react/tabs'; export default function Page(){return <Tabs.Root defaultValue='one'><Tabs.List aria-label='Pages'><Tabs.Tab value='one'>One</Tabs.Tab></Tabs.List><Tabs.Panel value='one'>Content</Tabs.Panel></Tabs.Root>}",
        },
      },
    },
  };
}

it('admits exact locked public facades through one shared context module with full notices', async () => {
  const catalog = await buildManagedCatalog();
  for (const [path, name] of Object.entries(BASE_UI_PARTS)) {
    expect(catalog.modules[`${BASE_UI_PACKAGE}/${path}`]?.source).toBe(
      `export { ${name} } from '${BASE_UI_PACKAGE}';`,
    );
  }
  const source = catalog.modules[BASE_UI_PACKAGE]!.source;
  for (const packageId of [
    '@base-ui/react@1.9.0',
    '@base-ui/utils@',
    '@floating-ui/',
    'use-sync-external-store@',
  ])
    expect(source).toContain(`/*! ${packageId}`);
  expect(source).toContain('Permission is hereby granted, free of charge');
  expect(
    catalog.manifest.packages.find((entry) => entry.packageId === BASE_UI_PACKAGE)?.integrity,
  ).toBe(await fingerprint(source));
  expect(gzipSync(source).byteLength).toBeLessThan(100_000);
  const page = fixture();
  const original = structuredClone(page);
  const result = await compileProject(page, { catalog });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.artifact.js.map((file) => file.content).join('\n')).not.toContain('from "@base-ui');
  expect(page).toEqual(original);
});

it('refuses missing/wrong locks and unsupported exports/subpaths without rewriting projects', async () => {
  const catalog = await buildManagedCatalog();
  for (const version of [undefined, '1.8.0']) {
    const page = fixture();
    if (version === undefined)
      Reflect.deleteProperty(page.project.dependencyLock.packages, BASE_UI_PACKAGE);
    else page.project.dependencyLock.packages[BASE_UI_PACKAGE] = version;
    expect(await compileProject(page, { catalog })).toMatchObject({ ok: false });
  }
  for (const path of ['select', '../internal']) {
    const page = fixture();
    page.project.files[page.entry]!.source =
      `import {Select} from '@base-ui/react/${path}';export default function Page(){return <Select.Root/>}`;
    expect(await compileProject(page, { catalog })).toMatchObject({ ok: false });
  }
  const unsupported = fixture();
  unsupported.project.files[unsupported.entry]!.source =
    "import {Select} from '@base-ui/react';export default function Page(){return <Select.Root/>}";
  expect(await compileProject(unsupported, { catalog })).toMatchObject({ ok: false });
});

it('leaves unused Base UI out of the emitted page even when available in its lock', async () => {
  const page = fixture();
  page.project.files[page.entry]!.source =
    'export default function Page(){return <main>Simple custom page</main>}';
  const result = await compileProject(page, { catalog: await buildManagedCatalog() });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.artifact.js.map((file) => file.content).join('\n')).not.toContain(
    '@base-ui/react@',
  );
});
