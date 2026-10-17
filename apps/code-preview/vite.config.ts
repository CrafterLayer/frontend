import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const runtimeEndpoint = new URL(env['VITE_CODE_RUNTIME_ENDPOINT'] ?? 'http://127.0.0.1:8787');
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5175,
      strictPort: true,
      allowedHosts: ['.localhost'],
      headers: { 'Origin-Agent-Cluster': '?1' },
      proxy: {
        // Artifacts remain same-origin to the isolated preview's strict CSP.
        '/artifacts': { target: runtimeEndpoint.origin, changeOrigin: false },
      },
    },
    build: { sourcemap: false },
  };
});
