/**
 * Custom Vitest matchers for package-build-stats tests
 */

import { expect } from 'vitest'

declare module 'vitest' {
  interface Assertion {
    toBeBetween(min: number, max: number): void
  }
  interface AsymmetricMatchersContaining {
    toBeBetween(min: number, max: number): void
  }
}

export const customMatchers = {
  toBeBetween(received: number, min: number, max: number) {
    const pass = received >= min && received <= max

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be between ${min} and ${max}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be between ${min} and ${max}`,
        pass: false,
      }
    }
  },
}

// Register the custom matchers
expect.extend(customMatchers)
