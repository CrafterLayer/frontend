import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/**
 * Why this package is BUILT before promptfoo ever sees it.
 *
 * Node can strip TypeScript types but it does not resolve extensionless
 * imports, and every package in this workspace imports `'./types'` rather than
 * `'./types.ts'`. A promptfoo run pointed straight at `src/` therefore dies on
 * the first relative import inside `@craftkit/builder-ai`, on a harness whose
 * typecheck and tests were both green. Vite's SSR build resolves exactly the
 * way vitest does, bundles the workspace packages in, and emits plain ESM that
 * Node runs with nothing else — the same fix, and the same reasoning, as
 * `apps/ai-server/vite.config.ts`.
 */
const entry = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

/**
 * The visual-regression entry is OPTIONAL on purpose.
 *
 * `src/visual/` is owned by a different workstream and may not exist in a
 * given checkout. A hard-coded input would make this build fail for everyone
 * whenever that directory is absent; probing for it means the eval harness and
 * the screenshot harness ship together when both exist and neither blocks the
 * other when only one does.
 */
function entries(): Record<string, string> {
  const inputs: Record<string, string> = {
    'promptfoo-provider': entry('./src/promptfoo/provider.ts'),
    'promptfoo-tests': entry('./src/promptfoo/tests.ts'),
    index: entry('./src/index.ts'),
  };
  const visual = entry('./src/visual/index.ts');
  if (existsSync(visual)) inputs['visual'] = visual;
  return inputs;
}

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: entries(),
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
      /*
        Not a precaution — without it this harness builds cleanly and then dies
        on the first case with "[Immer] The plugin for 'Patches' has not been
        loaded", which is exactly what happened the first time `pnpm eval` was
        run end to end.

        `packages/builder/core/src/patches/immer.ts` is a side-effect module: it
        calls `enablePatches()` once at import, because immer's patch plugin is
        opt-in and process-wide. immer's manifest declares `sideEffects: false`,
        which Rollup reads as a promise that calling its exports does nothing
        observable, so it deletes the call and keeps every line that depends on
        it. Vitest never notices because it loads modules instead of bundling
        them: the 137 tests in this package pass against a build that cannot
        create a single document. `apps/mcp-server` carries the same comment for
        the same reason.
      */
      treeshake: false,
    },
  },
  ssr: {
    /*
      Workspace packages are symlinked into node_modules, which Vite would
      externalize by default — and Node would then import their `.ts` source
      and fail exactly as described above. Bundle every `@craftkit/*`; leave
      Node's builtins and the image libraries the visual entry uses external,
      because those are real npm packages Node resolves on its own.
    */
    noExternal: [/^@craftkit\//],
    external: ['pixelmatch', 'pngjs', 'playwright'],
  },
});
