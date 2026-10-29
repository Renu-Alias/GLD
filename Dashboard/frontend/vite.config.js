import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to the bridge over the same origin so there is no CORS
// setup to get wrong. Change the target if you moved the bridge off port 4310.
const BRIDGE = process.env.BRIDGE_URL || 'http://127.0.0.1:4310';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BRIDGE,
        changeOrigin: true,
        // SSE must not be buffered by the dev proxy.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache, no-transform';
            }
          });
        },
      },
    },
  },
});