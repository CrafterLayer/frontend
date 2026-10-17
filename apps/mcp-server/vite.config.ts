import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/**
 * The QuickJS sandbox's Node worker (agent-script DESIGN §A.2.2, §A.13).
 *
 * `craftkit_apply_plan` runs `script.run` steps in a `worker_threads` worker,
 * and a worker is a FILE Node loads by URL — it cannot live inside `main.js`.
 * So the worker source from `@craftkit/builder-ai` is a second entry here,
 * bundled like `main.js` (its `./sandbox-core.js` and `./ck-prelude.js`
 * imports come in) and emitted as `dist/script-worker.mjs`, the URL `main.ts`
 * hands the runner. It is plain ESM JavaScript, so it is referenced by path:
 * it has no TypeScript importer to name it.
 */
const SCRIPT_WORKER = fileURLToPath(
  new URL('../../packages/builder/ai/src/script/sandbox-worker.node.mjs', import.meta.url),
);

/**
 * Why this server is BUILT rather than run from source.
 *
 * Node can strip TypeScript types, but it does not resolve extensionless
 * imports — and this workspace's packages import `'./types'`, not
 * `'./types.ts'`, everywhere. A `node --experimental-strip-types src/main.ts`
 * fails on the first relative import inside `@craftkit/builder-core`, while the
 * typecheck (Bundler resolution) and the tests (Vite's runner) both pass: the
 * server would be green on every gate and still not start. `apps/ai-server`
 * hit exactly this and this file is the same fix.
 *
 * Vite's SSR build resolves the same way the tests do, bundles the workspace
 * packages in, and emits plain ESM files Node runs with nothing else: the
 * server (`main.js`) and the script sandbox's worker (`script-worker.mjs`).
 */
export default defineConfig({
  build: {
    // `true` + `input` (not `ssr: 'src/main.ts'`): two entries, the ai-server's own pattern.
    ssr: true,
    target: 'node24',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: { main: 'src/main.ts', 'script-worker': SCRIPT_WORKER },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'script-worker' ? '[name].mjs' : '[name].js'),
      },
      /*
        `moduleSideEffects: true` is NOT a precaution — without it this server
        builds cleanly and then rejects every plan at the kernel door with
        "[Immer] The plugin for 'Patches' has not been loaded".

        `packages/builder/core/src/patches/immer.ts` is a side-effect module: it
        calls `enablePatches()` once, at import, because immer's patch plugin is
        opt-in and process-wide. immer's own manifest declares
        `sideEffects: false`, and Rollup reads that as a promise that calling
        immer's exports does nothing observable — so it deletes the call and
        keeps the code that depends on it. Every test passes, because Vitest
        loads modules instead of bundling them; only the shipped artifact is
        broken. Bundle size is irrelevant for a Node binary, so the honest trade
        is to run every module's top-level statements exactly as Node would.
      */
      treeshake: false,
    },
  },
  ssr: {
    /*
      Workspace packages are symlinked under node_modules, which Vite would
      externalize by default — and Node would then import their `.ts` source
      and fail exactly as before. Bundle every `@craftkit/*`; the MCP SDK and
      zod stay external, because both ship real published JavaScript that Node
      resolves on its own and the SDK's own dynamic requires (transports, auth)
      do not survive bundling.

      The QuickJS packages stay external too (script-servers, 2026-10-08): the
      variant package finds its `.wasm` next to its own module file, which a
      bundle would move away from it. They are this app's own dependencies, so
      Node resolves them from `apps/mcp-server/node_modules` at run time.
    */
    noExternal: [/^@craftkit\//],
    external: [
      '@modelcontextprotocol/sdk',
      'zod',
      'quickjs-emscripten-core',
      '@jitl/quickjs-wasmfile-release-sync',
      '@jitl/quickjs-ffi-types',
    ],
  },
});
