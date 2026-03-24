import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3060,
    proxy: {
      '/api': {
        target: 'http://localhost:3061',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Edge-worker friendly: single chunk, no code splitting for worker mode
    target: 'es2022',
    minify: true,
  },
});
