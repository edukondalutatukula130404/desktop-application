import { defineConfig } from 'vite';

const BACKEND_PORT = process.env.PORT || 5000;

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: false,
    open: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED' && res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Backend server connecting...' }));
            }
          });
        }
      }
    }
  }
});

