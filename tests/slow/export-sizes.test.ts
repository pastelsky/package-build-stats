/**
 * @jest-environment node
 *
 * Tests for package export size analysis
 * Covers getPackageExportSizes.ts with comprehensive fixtures
 */

import path from 'path'
import {
  getAllPackageExports,
  getPackageExportSizes,
} from '../../src/getPackageExportSizes'
import { PackageNotFoundError } from '../../src/errors/CustomError'
import { vi } from 'vitest'
import * as exportsUtils from '../../src/utils/exports.utils.js'
import BuildUtils from '../../src/utils/build.utils.js'
import InstallationUtils from '../../src/utils/installation.utils.js'

vi.mock('../../src/utils/common.utils.js', async importOriginal => {
  const original = (await importOriginal()) as any
  return {
    ...original,
    getExternals: vi.fn((packageName, installPath) => {
      try {
        return original.getExternals(packageName, installPath)
      } catch {
        return { externalPackages: [], externalBuiltIns: [] }
      }
    }),
  }
})

describe('getAllPackageExports', () => {
  test('should get exports from package with multiple exports', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/multi-exports',
    )

    const exports = await getAllPackageExports(fixturePath)

    expect(exports).toBeDefined()
    expect(typeof exports).toBe('object')
    expect(Object.keys(exports).length).toBeGreaterThan(0)

    // Should include main exports
    expect(exports).toHaveProperty('default')
  })

  test('should get exports from CommonJS package', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/cjs-exports',
    )

    const exports = await getAllPackageExports(fixturePath)

    expect(exports).toBeDefined()
    expect(typeof exports).toBe('object')
  })

  test('should handle package with re-exports', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/re-exports',
    )

    const exports = await getAllPackageExports(fixturePath)

    expect(exports).toBeDefined()
    expect(Object.keys(exports).length).toBeGreaterThan(0)
  })

  test('should handle package with nested imports', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/nested-imports',
    )

    const exports = await getAllPackageExports(fixturePath)

    expect(exports).toBeDefined()
    expect(Object.keys(exports).length).toBeGreaterThan(0)
  })

  test('should throw error for non-existent package', async () => {
    const nonExistentPackage =
      'definitely-does-not-exist-' + Date.now() + '-' + Math.random()

    try {
      await getAllPackageExports(nonExistentPackage)
      fail('Should have thrown an error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      // Should be PackageNotFoundError or InstallError
      if (error instanceof PackageNotFoundError) {
        expect(error.name).toBe('PackageNotFoundError')
      }
    }
  }, 30000)
})

describe('getPackageExportSizes', () => {
  test('should calculate sizes for package with multiple exports', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/multi-exports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    expect(result).toHaveProperty('assets')
    expect(Array.isArray(result.assets)).toBe(true)
    expect(result.assets.length).toBeGreaterThan(0)

    // Each asset should have size, gzip, and path
    result.assets.forEach(asset => {
      expect(asset).toHaveProperty('name')
      expect(asset).toHaveProperty('size')
      expect(asset).toHaveProperty('gzip')
      expect(asset).toHaveProperty('type')
      expect(asset).toHaveProperty('path')
      expect(asset.size).toBeGreaterThan(0)
    })
  })

  // CJS export test removed: ESM-only export scanning by design (following oxc-linter approach)

  test('should handle package with re-exports', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/re-exports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    expect(result.assets.length).toBeGreaterThan(0)

    // Verify all assets have paths
    result.assets.forEach(asset => {
      expect(asset.path).toBeDefined()
      expect(typeof asset.path).toBe('string')
    })
  })

  test('should filter out default export when splitCustomImports is used', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/mixed-exports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    // Default export should be filtered out, only named exports
    const assetNames = result.assets.map(a => a.name)
    expect(assetNames.every(name => name !== 'default')).toBe(true)
  })

  test('should handle nested imports correctly', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/nested-imports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    expect(result.assets).toBeDefined()
    expect(Array.isArray(result.assets)).toBe(true)
  })

  test('should throw error for non-existent package', async () => {
    const nonExistentPackage =
      'this-will-never-exist-' + Date.now() + '-' + Math.random()

    try {
      await getPackageExportSizes(nonExistentPackage)
      fail('Should have thrown an error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      // Error telemetry should be called (line 95-96)
    }
  }, 30000)

  test('should throw error for invalid package path', async () => {
    const invalidPath = '/this/path/does/not/exist/' + Date.now()

    try {
      await getPackageExportSizes(invalidPath)
      fail('Should have thrown an error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      // Should handle path resolution errors
    }
  }, 30000)
})

describe('Export Size Analysis Edge Cases', () => {
  test('should not include dependencySizes in export analysis', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/multi-exports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    // Should not include dependencySizes (it's set to false for export sizes)
    expect(result).not.toHaveProperty('dependencySizes')
  })

  test('should handle packages with only named exports', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/multi-exports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    expect(result.assets).toBeDefined()
    expect(result.assets.length).toBeGreaterThan(0)

    // Each export should have its own asset
    result.assets.forEach(asset => {
      expect(asset.name).toBeDefined()
      expect(asset.size).toBeGreaterThan(0)
      expect(asset.gzip).toBeGreaterThan(0)
    })
  })

  test('should map export names to source file paths', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/multi-exports',
    )

    const result = await getPackageExportSizes(fixturePath)

    expect(result).toBeDefined()
    // Each asset should have path showing source location
    result.assets.forEach(asset => {
      expect(asset).toHaveProperty('path')
      expect(typeof asset.path).toBe('string')
      expect(asset.path.length).toBeGreaterThan(0)
    })
  })

  test('should only compile the first 1000 exports and return placeholders with size 0/gzip 0 for the rest', async () => {
    const memorySpy = vi
      .spyOn(process.memoryUsage, 'rss')
      .mockReturnValue(100 * 1024 * 1024)
    const installSpy = vi
      .spyOn(InstallationUtils, 'installPackage')
      .mockImplementation(async () => {})
    const getAllExportsSpy = vi
      .spyOn(exportsUtils, 'getAllExports')
      .mockImplementation(async () => {
        const mockExports: Record<string, string> = {}
        for (let i = 0; i < 1050; i++) {
          mockExports[`export_${i}`] = `src/file_${i}.js`
        }
        return mockExports
      })

    const buildSpy = vi
      .spyOn(BuildUtils, 'buildPackageIgnoringMissingDeps')
      .mockImplementation(async args => {
        const customImports = args.options?.customImports || []
        const assets = customImports.map(name => ({
          name,
          type: 'js',
          size: 100,
          gzip: 50,
        }))
        return {
          assets,
        }
      })

    try {
      const result = await getPackageExportSizes('some-package')

      expect(buildSpy).toHaveBeenCalledTimes(11)
      expect(result.assets.length).toBe(1050)

      expect(result.assets[0]).toEqual({
        name: 'export_0',
        type: 'js',
        size: 100,
        gzip: 50,
        path: 'src/file_0.js',
      })
      expect(result.assets[999]).toEqual({
        name: 'export_999',
        type: 'js',
        size: 100,
        gzip: 50,
        path: 'src/file_999.js',
      })

      expect(result.assets[1000]).toEqual({
        name: 'export_1000',
        type: 'js',
        size: 0,
        gzip: 0,
        path: 'src/file_1000.js',
      })
      expect(result.assets[1049]).toEqual({
        name: 'export_1049',
        type: 'js',
        size: 0,
        gzip: 0,
        path: 'src/file_1049.js',
      })
    } finally {
      getAllExportsSpy.mockRestore()
      buildSpy.mockRestore()
      installSpy.mockRestore()
      memorySpy.mockRestore()
    }
  })

  test('should grow batches below the configured worker budget', async () => {
    const memorySpy = vi
      .spyOn(process.memoryUsage, 'rss')
      .mockReturnValue(900 * 1024 * 1024)
    const installSpy = vi
      .spyOn(InstallationUtils, 'installPackage')
      .mockImplementation(async () => {})
    const getAllExportsSpy = vi
      .spyOn(exportsUtils, 'getAllExports')
      .mockImplementation(async () => {
        const mockExports: Record<string, string> = {}
        for (let i = 0; i < 150; i++) {
          mockExports[`export_${i}`] = `src/file_${i}.js`
        }
        return mockExports
      })

    const buildSpy = vi
      .spyOn(BuildUtils, 'buildPackageIgnoringMissingDeps')
      .mockImplementation(async args => {
        const customImports = args.options?.customImports || []
        const assets = customImports.map(name => ({
          name,
          type: 'js',
          size: 100,
          gzip: 50,
        }))
        return {
          assets,
        }
      })

    try {
      const result = await getPackageExportSizes('some-package', {
        memoryLimitBytes: 2 * 1024 * 1024 * 1024,
      })

      expect(buildSpy).toHaveBeenCalledTimes(3)

      expect(buildSpy.mock.calls[0][0].options?.customImports?.length).toBe(20)
      expect(buildSpy.mock.calls[0][0].options?.customImports?.[0]).toBe(
        'export_0',
      )
      expect(buildSpy.mock.calls[0][0].options?.customImports?.[19]).toBe(
        'export_19',
      )

      expect(buildSpy.mock.calls[2][0].options?.customImports?.length).toBe(30)
      expect(buildSpy.mock.calls[2][0].options?.customImports?.[0]).toBe(
        'export_120',
      )
      expect(buildSpy.mock.calls[2][0].options?.customImports?.[29]).toBe(
        'export_149',
      )

      expect(result.assets.length).toBe(150)
      expect(result.assets[0]).toEqual({
        name: 'export_0',
        type: 'js',
        size: 100,
        gzip: 50,
        path: 'src/file_0.js',
      })
      expect(result.assets[149]).toEqual({
        name: 'export_149',
        type: 'js',
        size: 100,
        gzip: 50,
        path: 'src/file_149.js',
      })
    } finally {
      getAllExportsSpy.mockRestore()
      buildSpy.mockRestore()
      installSpy.mockRestore()
      memorySpy.mockRestore()
    }
  })
  test.each([0, -1, NaN, Infinity])(
    'rejects invalid memory budget %s',
    async memoryLimitBytes => {
      await expect(
        getPackageExportSizes('some-package', { memoryLimitBytes }),
      ).rejects.toThrow(
        'memoryLimitBytes must be a positive, finite byte count',
      )
    },
  )
  test.each([
    [true, 512],
    [false, 512],
    [true, 2048],
    [false, 2048],
  ] as const)(
    'keeps serial, smaller batches after pressure (already high: %s, budget MiB: %s)',
    async (alreadyHigh, budgetMiB) => {
      const names = Array.from({ length: 250 }, (_, index) => `export_${index}`)
      const memorySpy = vi
        .spyOn(process.memoryUsage, 'rss')
        .mockReturnValue(100 * 1024 * 1024)
      memorySpy.mockReturnValueOnce(
        (alreadyHigh ? budgetMiB * 0.8 : 100) * 1024 * 1024,
      )
      if (!alreadyHigh) {
        memorySpy.mockReturnValueOnce(100 * 1024 * 1024)
        memorySpy.mockReturnValueOnce(budgetMiB * 0.8 * 1024 * 1024)
      }
      const installSpy = vi
        .spyOn(InstallationUtils, 'installPackage')
        .mockImplementation(async () => {})
      const exportsSpy = vi
        .spyOn(exportsUtils, 'getAllExports')
        .mockResolvedValue(
          Object.fromEntries(names.map(name => [name, `src/${name}.js`])),
        )
      const batches: string[][] = []
      let active = 0
      let peakActive = 0
      const buildSpy = vi
        .spyOn(BuildUtils, 'buildPackageIgnoringMissingDeps')
        .mockImplementation(async args => {
          const imports = args.options?.customImports || []
          batches.push(imports)
          peakActive = Math.max(peakActive, ++active)
          await Promise.resolve()
          active--
          return {
            assets: imports.map(name => ({
              name,
              type: 'js',
              size: 100,
              gzip: 50,
            })),
          }
        })
      try {
        const result = await getPackageExportSizes('some-package', {
          memoryLimitBytes: budgetMiB * 1024 * 1024,
        })
        expect(batches[0]).toHaveLength(20)
        if (!alreadyHigh) expect(batches[1]).toHaveLength(100)
        expect(
          batches.slice(alreadyHigh ? 1 : 2).every(batch => batch.length <= 20),
        ).toBe(true)
        expect(batches.flat()).toEqual(names)
        expect(result.assets.map(asset => asset.name)).toEqual(names)
        expect(
          result.assets.every(
            asset =>
              asset.size === 100 &&
              asset.gzip === 50 &&
              asset.path === `src/${asset.name}.js`,
          ),
        ).toBe(true)
        expect(peakActive).toBe(1)
      } finally {
        buildSpy.mockRestore()
        exportsSpy.mockRestore()
        installSpy.mockRestore()
        memorySpy.mockRestore()
      }
    },
  )
})
