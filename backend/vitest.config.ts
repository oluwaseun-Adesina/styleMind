import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 90000,
    // Integration tests share an in-memory Mongo per file; run files sequentially
    // to keep memory use low and avoid port contention.
    fileParallelism: false,
  },
});
