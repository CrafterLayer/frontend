import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const entry = fileURLToPath(new URL('./src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry,
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['@tanstack/react-query', 'react', 'react/jsx-runtime'],
    },
  },
});
