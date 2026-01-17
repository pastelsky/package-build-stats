import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/build/**'],
    setupFiles: ['./tests/helpers/custom-matchers.ts'],
    testTimeout: 90000, // 90 seconds for functional tests with package installations
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,ts}'],
      exclude: [
        'src/**/*.d.ts',
        'src/types.ts',
        '**/node_modules/**',
        '**/build/**',
        '**/tests/**',
      ],
    },
    // Allow ESM modules and handle CJS/ESM interop
    deps: {
      inline: ['oxc-parser', 'oxc-resolver', '@oxc-project/types'],
    },
    server: {
      deps: {
        inline: true,
      },
    },
  },
})
