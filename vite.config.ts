import { defineConfig } from 'vite';

// The demo lives in demo/ and imports the library straight from src/.
// An explicit empty PostCSS config keeps Vite from picking up a postcss.config.js from a parent folder.
export default defineConfig({
  root: 'demo',
  base: './',
  css: { postcss: {} },
  server: { port: 5320 },
  build: { outDir: '../dist-demo', emptyOutDir: true },
});
