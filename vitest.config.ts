import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (whose root is demo/) so the tests are found from the project root.
export default defineConfig({
  css: { postcss: {} },
  test: { root: '.', include: ['test/**/*.test.ts'], environment: 'node' },
});
