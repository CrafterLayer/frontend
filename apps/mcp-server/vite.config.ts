import { defineConfig } from 'vite';

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
 * packages in, and emits one plain ESM file Node runs with nothing else.
 */
export default defineConfig({
  build: {
    ssr: 'src/main.ts',
    target: 'node24',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: { entryFileNames: 'main.js' },
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
    */
    noExternal: [/^@craftkit\//],
    external: ['@modelcontextprotocol/sdk', 'zod'],
  },
});
