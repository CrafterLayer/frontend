import { defineConfig } from 'vite';

/**
 * Why this server is BUILT rather than run from source.
 *
 * Node can strip TypeScript types, but it does not resolve extensionless
 * imports — and this workspace's packages import `'./types'`, not
 * `'./types.ts'`, everywhere. A `node --experimental-strip-types src/main.ts`
 * fails on the first relative import inside `@craftkit/builder-ai`, while the
 * typecheck (Bundler resolution) and the tests (Vite's runner) both pass. The
 * server was green on every gate and did not start. This file is the fix.
 *
 * Vite's SSR build resolves the same way the tests do, bundles the workspace
 * packages in, and emits one plain ESM file Node runs with nothing else.
 */
export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'src/main.ts',
        'runtime-worker-entry': 'src/runtime-worker-entry.ts',
      },
      output: { entryFileNames: '[name].js' },
    },
  },
  ssr: {
    /*
      Workspace packages are symlinked under node_modules, which Vite would
      externalize by default — and Node would then import their `.ts` source
      and fail exactly as before. Bundle every `@craftkit/*`; leave the SDK and
      Node's builtins external where they belong.
    */
    noExternal: [/^@craftkit\//],
    external: ['@anthropic-ai/sdk', 'esbuild', 'playwright'],
  },
});
