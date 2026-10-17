import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/*
  Long-term caching of the first load (performance pass, 2026-10-13).

  The entry chunk carried every third-party module the editor needs at boot —
  React DOM, the full lucide icon set, Radix, dnd-kit, culori, sonner — in ONE
  file whose hash changes with every edit to the app or a workspace package.
  Each deploy therefore re-sent ~375 KB gzip of library code nobody changed.

  These groups move that code into three chunks whose hashes only change when
  the dependency itself does. They are restricted to `$initial` modules (code
  the entry already loads statically), so nothing a lazy panel loads on demand
  is pulled into the first load: the initial byte count stays the same, and the
  cache-stable share of it is what grows. Workspace packages are not under
  `node_modules`, so they stay with the app code that changes with them. Only
  JavaScript is grouped: stylesheets keep their place in the one cascade.
*/
const vendor = (packages: string) =>
  new RegExp(`[\\\\/]node_modules[\\\\/](?:${packages})[\\\\/].*\\.[cm]?js$`);

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: vendor('react|react-dom|scheduler'),
              tags: ['$initial'],
              priority: 3,
            },
            { name: 'vendor-icons', test: vendor('lucide'), tags: ['$initial'], priority: 2 },
            { name: 'vendor', test: vendor('.+?'), tags: ['$initial'], priority: 1 },
          ],
        },
      },
    },
  },
});
