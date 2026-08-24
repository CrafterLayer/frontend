import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const entry = fileURLToPath(new URL('./src/build.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry,
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
