import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { build } from 'esbuild';
import { fingerprint } from '@craftkit/builder-code-runtime/compiler';
import type { ManagedCatalog } from '@craftkit/builder-code-runtime';

import {
  MANAGED_REACT_VERSION,
  MANAGED_RUNTIME_SPECIFIER,
  referenceManagedCatalog,
} from './managed-catalog';

// SSR bundles relocate this module into an app chunk. Resolve the public facade
// (a declared app dependency) first so pnpm lookup remains owned by this package.
// resolve() locates the entry; it never executes TypeScript or authored code.
const hostRequire = createRequire(import.meta.url);
const facadeEntry = hostRequire.resolve('@craftkit/builder/code-runtime/compiler');
const require = createRequire(facadeEntry);
const catalogDirectory = dirname(facadeEntry);
let pendingCatalog: Promise<ManagedCatalog> | undefined;

/**
 * Trusted catalog build only: input specifiers are platform-owned constants.
 * Authored project files never enter filesystem resolution or this build.
 * The returned virtual module includes React/DOM and works independently of the editor.
 */
export async function buildManagedCatalog(): Promise<ManagedCatalog> {
  pendingCatalog ??= buildPinnedCatalog().catch((error: unknown) => {
    pendingCatalog = undefined;
    throw error;
  });
  return structuredClone(await pendingCatalog);
}

async function buildPinnedCatalog(): Promise<ManagedCatalog> {
  const motionRequire = createRequire(require.resolve('@craftkit/builder-motion/react'));
  const carouselEntry = require.resolve('@craftkit/builder-media-engines/carousel');
  const carouselRequire = createRequire(carouselEntry);
  const pins = [
    { name: 'react', version: MANAGED_REACT_VERSION, resolver: require },
    { name: 'react-dom', version: MANAGED_REACT_VERSION, resolver: require },
    { name: 'lucide-react', version: '1.43.0', resolver: require },
    { name: 'tailwindcss', version: '4.3.3', resolver: require },
    { name: 'motion', version: '13.1.1', resolver: motionRequire },
    { name: 'embla-carousel', version: '8.6.0', resolver: carouselRequire },
  ];
  const licenses: Record<string, string> = {};
  for (const { name, version, resolver } of pins) {
    const path = resolver.resolve(`${name}/package.json`);
    const manifest = JSON.parse(await readFile(path, 'utf8')) as {
      version: string;
    };
    if (manifest.version !== version) {
      throw new Error(`Managed ${name} must be pinned to ${version}.`);
    }
    licenses[name] =
      `/*! ${name}@${version}\n${(await readFile(name === 'embla-carousel' ? join(dirname(carouselEntry), '../vendor/embla-carousel/LICENSE') : join(dirname(path), name === 'motion' ? 'LICENSE.md' : 'LICENSE'), 'utf8')).replaceAll('*/', '* /')}\n*/\n`;
  }
  const result = await build({
    stdin: {
      contents:
        "export * as React from 'react'; export * as jsxRuntime from 'react/jsx-runtime'; export * as reactDomClient from 'react-dom/client'; export * as reactDom from 'react-dom';",
      loader: 'js',
      sourcefile: 'craftkit-trusted-runtime.js',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'inline',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: {
      react: require.resolve('react'),
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      'react-dom/client': require.resolve('react-dom/client'),
      'react-dom': require.resolve('react-dom'),
    },
    logLevel: 'silent',
  });
  const source = result.outputFiles[0]?.text;
  if (source === undefined) throw new Error('The trusted runtime build produced no module.');
  const integrity = await fingerprint(source);
  const [lucideBundle, motionBundle, carouselBundle, theme, preflight] = await Promise.all([
    buildLibrary('lucide-react'),
    buildLibrary('@craftkit/builder-motion/react'),
    buildLibrary('@craftkit/builder-media-engines/carousel', true),
    readFile(require.resolve('tailwindcss/theme.css'), 'utf8'),
    readFile(require.resolve('tailwindcss/preflight.css'), 'utf8'),
  ]);
  const lucide = (licenses['lucide-react'] ?? '') + lucideBundle;
  const motion = (licenses['motion'] ?? '') + motionBundle;
  const carousel = (licenses['embla-carousel'] ?? '') + carouselBundle;
  const stylesheet = `${licenses['tailwindcss'] ?? ''}@layer theme, base, components, utilities;\n@layer theme {${theme}}\n@layer base {${preflight}}\n@layer utilities { @tailwind utilities; }`;
  const librarySources: Record<string, string> = {
    'lucide-react': lucide,
    motion,
    tailwindcss: stylesheet,
    'embla-carousel': carousel,
  };
  const packages = await Promise.all(
    referenceManagedCatalog.manifest.packages.map(async (entry) => ({
      ...entry,
      integrity:
        librarySources[entry.packageId] === undefined
          ? integrity
          : await fingerprint(librarySources[entry.packageId]),
    })),
  );
  return {
    compatibleLockVersions: referenceManagedCatalog.compatibleLockVersions ?? {},
    manifest: {
      ...referenceManagedCatalog.manifest,
      packages,
    },
    modules: {
      ...referenceManagedCatalog.modules,
      [MANAGED_RUNTIME_SPECIFIER]: { language: 'js', source },
      'lucide-react': { language: 'js', source: lucide },
      'motion/react': { language: 'js', source: motion },
      'embla-carousel': { language: 'js', source: carousel },
      tailwindcss: { language: 'css', source: stylesheet },
    },
    stylesheet,
  };
}

async function buildLibrary(
  specifier:
    'lucide-react' | '@craftkit/builder-motion/react' | '@craftkit/builder-media-engines/carousel',
  defaultExport = false,
): Promise<string> {
  const result = await build({
    absWorkingDir: catalogDirectory,
    stdin: {
      contents: `export * from '${specifier}';${defaultExport ? ` export { default } from '${specifier}';` : ''}`,
      resolveDir: catalogDirectory,
      loader: 'js',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    mainFields: ['module', 'browser', 'main'],
    minify: true,
    legalComments: 'inline',
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  const source = result.outputFiles[0]?.text;
  if (source === undefined) throw new Error(`Managed library did not build: ${specifier}`);
  return source;
}
