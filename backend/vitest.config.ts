import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false, // tests share one local Postgres DB — avoid cross-file races
  },
})
