/**
 * Functional Tests for package-build-stats
 *
 * These tests focus on testing behavior, not implementation details.
 * They test the actual outputs (sizes, gzip, dependencies) against known values.
 */

import { getPackageStats, getPackageExportSizes } from '../src'
import 'dotenv/config'

// Increased timeout for real package installations and builds

/**
 * Helper to check if a value is within acceptable delta
 * This allows for minor variations in build outputs
 */
const isWithinDelta = (
  actual: number,
  expected: number,
  maxDelta = 5 * 1024,
): boolean => {
  const diff = Math.abs(actual - expected)
  if (diff <= maxDelta) return true
  // Also accept if difference is less than 5% of expected
  return diff / expected < 0.05
}

expect.extend({
  toBeWithinDelta(received, expected, maxDelta = 5 * 1024) {
    const pass = isWithinDelta(received, expected, maxDelta)
    return {
      pass,
      message: () =>
        `Expected ${received} to be within ${maxDelta} bytes of ${expected}. Diff: ${Math.abs(
          received - expected,
        )}`,
    }
  },
})

describe('Functional Tests - Package Building & Sizing', () => {
  describe('Basic Package Stats', () => {
    test('should build and size a simple package (redux)', async () => {
      const result = await getPackageStats('redux@3.7.2')

      // Test that we get all expected fields
      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('gzip')
      expect(result).toHaveProperty('dependencyCount')
      expect(result).toHaveProperty('hasSideEffects')

      // Redux 3.7.2 should be approximately 5.76KB
      expect(result.size).toBeWithinDelta(5.76 * 1024, 2 * 1024)

      // Gzip should be reasonable (typically 30-50% of size)
      expect(result.gzip).toBeLessThan(result.size)
      expect(result.gzip).toBeGreaterThan(result.size * 0.2)

      // Redux has no dependencies
      expect(result.dependencyCount).toBe(0)
    })

    test('should handle package with CSS assets (bootstrap)', async () => {
      const result = await getPackageStats('bootstrap@3.3.7')

      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('gzip')
      expect(result).toHaveProperty('assets')

      // Bootstrap 3.3.7 should be approximately 37KB
      expect(result.size).toBeWithinDelta(37 * 1024, 5 * 1024)

      // Should have CSS assets
      const hasCSSAssets = result.assets.some(asset => asset.type === 'css')
      expect(hasCSSAssets).toBe(true)
    })

    test('should handle scoped packages (@babel/runtime)', async () => {
      const result = await getPackageStats('@babel/runtime@7.12.0')

      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('gzip')

      // @babel/runtime should have reasonable size
      expect(result.size).toBeGreaterThan(1024) // At least 1KB
      expect(result.size).toBeLessThan(500 * 1024) // Less than 500KB
    })
  })

  describe('Package with Dependencies', () => {
    test('should calculate dependency sizes for package with deps', async () => {
      const result = await getPackageStats('axios@0.16.2')

      expect(result).toHaveProperty('dependencySizes')
      expect(Array.isArray(result.dependencySizes)).toBe(true)

      // Axios has dependencies
      expect(result.dependencyCount).toBeGreaterThan(0)

      // Dependency sizes should be calculated
      if (result.dependencySizes && result.dependencySizes.length > 0) {
        result.dependencySizes.forEach(dep => {
          expect(dep).toHaveProperty('name')
          expect(dep).toHaveProperty('approximateSize')
          expect(typeof dep.approximateSize).toBe('number')
          expect(dep.approximateSize).toBeGreaterThan(0)
        })
      }

      // Total size should be reasonable
      expect(result.size).toBeWithinDelta(12.67 * 1024, 5 * 1024)
    })
  })

  describe('Custom Imports', () => {
    test('should handle custom imports (lodash specific functions)', async () => {
      const result = await getPackageStats('lodash@4.17.21', {
        customImports: ['debounce', 'throttle'],
      })

      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('gzip')

      // Custom imports should result in smaller size than full lodash
      // Full lodash is ~72KB, debounce+throttle should be much smaller
      expect(result.size).toBeLessThan(30 * 1024)
      expect(result.size).toBeGreaterThan(2 * 1024)
    })
  })

  describe('Module Types', () => {
    test('should identify package with module field (preact)', async () => {
      const result = await getPackageStats('preact@8.2.5')

      expect(result).toHaveProperty('hasJSModule')
      expect(result.hasJSModule).toBeTruthy()

      // Preact should be small
      expect(result.size).toBeWithinDelta(8.28 * 1024, 2 * 1024)
    })

    test('should identify package type (module vs commonjs)', async () => {
      const result = await getPackageStats('redux@3.7.2')

      expect(result).toHaveProperty('isModuleType')
      expect(typeof result.isModuleType).toBe('boolean')
    })
  })

  describe('Peer Dependencies', () => {
    test('should identify and handle peer dependencies (react-dom)', async () => {
      const result = await getPackageStats('react-dom@15.6.1')

      expect(result).toHaveProperty('peerDependencies')
      expect(Array.isArray(result.peerDependencies)).toBe(true)

      // react-dom has react as peer dependency
      expect(result.peerDependencies).toContain('react')

      // Should build successfully despite peer deps
      expect(result.size).toBeWithinDelta(127 * 1024, 10 * 1024)
    })
  })

  describe('Size Consistency', () => {
    test('should return consistent sizes for same package (idempotent)', async () => {
      const result1 = await getPackageStats('redux@3.7.2')
      const result2 = await getPackageStats('redux@3.7.2')

      // Sizes should be exactly the same for the same package
      expect(result1.size).toBe(result2.size)
      expect(result1.gzip).toBe(result2.gzip)
    })
  })

  describe('Gzip Compression', () => {
    test('should provide realistic gzip compression ratios', async () => {
      const packages = ['redux@3.7.2', 'preact@8.2.5', 'axios@0.16.2']

      for (const pkg of packages) {
        const result = await getPackageStats(pkg)

        // Gzip should be 20-70% of original size (typical range)
        const compressionRatio = result.gzip / result.size
        expect(compressionRatio).toBeGreaterThan(0.2)
        expect(compressionRatio).toBeLessThan(0.7)
      }
    })
  })

  describe('Assets', () => {
    test('should generate proper asset information', async () => {
      const result = await getPackageStats('redux@3.7.2')

      expect(result).toHaveProperty('assets')
      expect(Array.isArray(result.assets)).toBe(true)

      // Should have at least a main bundle
      const mainAsset = result.assets.find(
        asset => asset.name === 'main' && asset.type === 'js',
      )
      expect(mainAsset).toBeDefined()

      if (mainAsset) {
        expect(mainAsset).toHaveProperty('size')
        expect(mainAsset).toHaveProperty('gzip')
        expect(mainAsset.size).toBeGreaterThan(0)
        expect(mainAsset.gzip).toBeGreaterThan(0)
      }
    })
  })

  describe('Different Minifiers', () => {
    test('should work with terser minifier', async () => {
      const result = await getPackageStats('redux@3.7.2', {
        minifier: 'terser',
      })

      expect(result).toHaveProperty('size')
      expect(result.size).toBeGreaterThan(0)
    })

    test('should work with esbuild minifier', async () => {
      const result = await getPackageStats('redux@3.7.2', {
        minifier: 'esbuild',
      })

      expect(result).toHaveProperty('size')
      expect(result.size).toBeGreaterThan(0)

      // esbuild is typically slightly larger but faster
      expect(result.size).toBeWithinDelta(5.76 * 1024, 3 * 1024)
    })

    test('should work with swc minifier', async () => {
      const result = await getPackageStats('redux@3.7.2', {
        minifier: 'swc',
      })

      expect(result).toHaveProperty('size')
      expect(result.size).toBeGreaterThan(0)
    })
  })
})

describe('Functional Tests - Export Sizes', () => {
  describe('getPackageExportSizes', () => {
    test('should calculate sizes for individual exports', async () => {
      const result = await getPackageExportSizes('lodash@4.17.21', {
        minifier: 'terser',
      })

      expect(result).toHaveProperty('assets')
      expect(Array.isArray(result.assets)).toBe(true)
      expect(result.assets.length).toBeGreaterThan(0)

      // Each export should have size information
      result.assets.forEach(asset => {
        expect(asset).toHaveProperty('name')
        expect(asset).toHaveProperty('size')
        expect(asset).toHaveProperty('gzip')
        expect(asset).toHaveProperty('type')
        expect(asset.size).toBeGreaterThan(0)
      })
    })
  })
})

describe('Functional Tests - Error Handling', () => {
  describe('Invalid Packages', () => {
    test('should handle non-existent package gracefully', async () => {
      await expect(
        getPackageStats('this-package-absolutely-does-not-exist-12345@1.0.0'),
      ).rejects.toThrow()
    })

    test('should handle invalid version gracefully', async () => {
      await expect(getPackageStats('redux@99999.99999.99999')).rejects.toThrow()
    })
  })

  describe('Missing Dependencies', () => {
    test('should handle packages with missing peer dependencies', async () => {
      // react-redux requires react as peer dep
      // Should still build by externalizing it
      const result = await getPackageStats('react-redux@5.0.6')

      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('peerDependencies')
      expect(result.peerDependencies).toContain('react')
    })
  })
})

describe('Functional Tests - Real World Scenarios', () => {
  describe('UI Framework Packages', () => {
    const uiPackages = [
      { name: 'react@16.0.0', expectedSize: 6.73 * 1024, delta: 2 * 1024 },
      { name: 'preact@8.2.5', expectedSize: 8.28 * 1024, delta: 2 * 1024 },
      { name: 'vue@2.4.2', expectedSize: 58.4 * 1024, delta: 8 * 1024 },
    ]

    test.each(uiPackages)(
      'should accurately size $name',
      async ({ name, expectedSize, delta }) => {
        const result = await getPackageStats(name)
        expect(result.size).toBeWithinDelta(expectedSize, delta)
      },
    )
  })

  describe('Utility Libraries', () => {
    const utilPackages = [
      { name: 'moment@2.18.1', expectedSize: 240 * 1024, delta: 20 * 1024 },
      { name: 'bluebird@3.5.0', expectedSize: 75.65 * 1024, delta: 10 * 1024 },
      { name: 'async@2.5.0', expectedSize: 23.74 * 1024, delta: 5 * 1024 },
    ]

    test.each(utilPackages)(
      'should accurately size $name',
      async ({ name, expectedSize, delta }) => {
        const result = await getPackageStats(name)
        expect(result.size).toBeWithinDelta(expectedSize, delta)
      },
    )
  })

  describe('CSS Libraries', () => {
    const cssPackages = [
      {
        name: 'animate.css@3.5.2',
        expectedSize: 52.79 * 1024,
        delta: 8 * 1024,
      },
      { name: 'tachyons@4.8.1', expectedSize: 80.69 * 1024, delta: 10 * 1024 },
    ]

    test.each(cssPackages)(
      'should accurately size $name',
      async ({ name, expectedSize, delta }) => {
        const result = await getPackageStats(name)
        expect(result.size).toBeWithinDelta(expectedSize, delta)

        // CSS libraries should have CSS assets
        const hasCSSAsset = result.assets.some(asset => asset.type === 'css')
        expect(hasCSSAsset).toBe(true)
      },
    )
  })
})

describe('Functional Tests - Bundler Comparison', () => {
  describe('Webpack vs Rspack', () => {
    const testPackages = ['redux@3.7.2', 'preact@8.2.5']

    test.each(testPackages)(
      'should produce similar results for %s with both bundlers',
      async packageName => {
        const webpackResult = await getPackageStats(packageName, {
          bundler: 'webpack4',
          minifier: 'terser',
        })

        const rspackResult = await getPackageStats(packageName, {
          bundler: 'rspack',
          minifier: 'swc',
        })

        // Sizes should be within 10% of each other
        const sizeDiff = Math.abs(webpackResult.size - rspackResult.size)
        const sizeRatio = sizeDiff / webpackResult.size

        expect(sizeRatio).toBeLessThan(0.1) // Within 10%

        // Both should have similar structure
        expect(webpackResult).toHaveProperty('size')
        expect(rspackResult).toHaveProperty('size')
        expect(webpackResult).toHaveProperty('gzip')
        expect(rspackResult).toHaveProperty('gzip')
      },
    )
  })
})
