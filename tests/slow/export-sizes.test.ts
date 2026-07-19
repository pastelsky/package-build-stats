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
import { PackageNotFoundError, UnsupportedPackageError } from '../../src/errors/CustomError'
import { vi } from 'vitest'
import * as exportsUtils from '../../src/utils/exports.utils.js'
import BuildUtils from '../../src/utils/build.utils.js'
import InstallationUtils from '../../src/utils/installation.utils.js'

vi.mock('../../src/utils/common.utils.js', async (importOriginal) => {
  const original = await importOriginal() as any
  return {
    ...original,
    getExternals: vi.fn((packageName, installPath) => {
      try {
        return original.getExternals(packageName, installPath)
      } catch (err) {
        return { externalPackages: [], externalBuiltIns: [] }
      }
    })
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
    const installSpy = vi.spyOn(InstallationUtils, 'installPackage').mockImplementation(async () => {})
    const getAllExportsSpy = vi.spyOn(exportsUtils, 'getAllExports').mockImplementation(async () => {
      const mockExports: Record<string, string> = {}
      for (let i = 0; i < 1050; i++) {
        mockExports[`export_${i}`] = `src/file_${i}.js`
      }
      return mockExports
    })

    const buildSpy = vi.spyOn(BuildUtils, 'buildPackageIgnoringMissingDeps').mockImplementation(async (args) => {
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
      
      expect(buildSpy).toHaveBeenCalledTimes(10)
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
    }
  })

  test('should chunk export compilation serially in batches of 100 internally without breaking response format', async () => {
    const installSpy = vi.spyOn(InstallationUtils, 'installPackage').mockImplementation(async () => {})
    const getAllExportsSpy = vi.spyOn(exportsUtils, 'getAllExports').mockImplementation(async () => {
      const mockExports: Record<string, string> = {}
      for (let i = 0; i < 150; i++) {
        mockExports[`export_${i}`] = `src/file_${i}.js`
      }
      return mockExports
    })

    const buildSpy = vi.spyOn(BuildUtils, 'buildPackageIgnoringMissingDeps').mockImplementation(async (args) => {
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
      
      expect(buildSpy).toHaveBeenCalledTimes(2)
      
      expect(buildSpy.mock.calls[0][0].options?.customImports?.length).toBe(100)
      expect(buildSpy.mock.calls[0][0].options?.customImports?.[0]).toBe('export_0')
      expect(buildSpy.mock.calls[0][0].options?.customImports?.[99]).toBe('export_99')

      expect(buildSpy.mock.calls[1][0].options?.customImports?.length).toBe(50)
      expect(buildSpy.mock.calls[1][0].options?.customImports?.[0]).toBe('export_100')
      expect(buildSpy.mock.calls[1][0].options?.customImports?.[49]).toBe('export_149')

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
    }
  })
})
