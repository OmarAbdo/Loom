import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the ticketing SPA.
 *
 * DEV PROXY: in `vite dev`, requests to /api/* are proxied to the ingress so the
 * browser sees a same-origin app (cookies flow without CORS). Point VITE_API_TARGET
 * at wherever the cluster ingress is reachable (default assumes a port-forward on
 * https://localhost:8443 with the ticketing.dev Host header).
 *
 * In production the SPA is served by nginx BEHIND the same ingress as the APIs,
 * so /api/* is already same-origin and no proxy is involved.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        headers: { Host: 'ticketing.dev' },
      },
    },
  },
});
