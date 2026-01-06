import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env from monorepo root (../../.env)
    const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
    return {
      envDir: path.resolve(__dirname, '../..'),
      server: {
        port: 3050,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3051',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
