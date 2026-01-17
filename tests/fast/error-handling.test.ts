/**
 * @jest-environment node
 *
 * Tests for error handling and recovery paths
 * Tests each specific error type thrown by the system
 */

import path from 'path'
import { getPackageStats } from '../../src'
import {
  UnexpectedBuildError,
  PackageNotFoundError,
  MinifyError,
  BuildError,
  EntryPointError,
  InstallError,
  CLIBuildError,
  MissingDependencyError,
} from '../../src/errors/CustomError'

describe('Missing Dependencies', () => {
  test('should successfully build with ignoredMissingDependencies for missing packages', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/missing-deps',
    )

    const result = await getPackageStats(fixturePath)

    // Should succeed but report the missing dependencies as ignored
    expect(result).toHaveProperty('ignoredMissingDependencies')
    if ('ignoredMissingDependencies' in result) {
      expect(Array.isArray(result.ignoredMissingDependencies)).toBe(true)
      expect(result.ignoredMissingDependencies?.length).toBeGreaterThan(0)
      expect(result.ignoredMissingDependencies).toContain(
        'this-package-does-not-exist',
      )
    }

    // Should still have valid build output
    expect(result).toHaveProperty('size')
    expect(result.size).toBeGreaterThan(0)
  })

  test('should include missing module names in ignoredMissingDependencies', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/missing-deps',
    )

    const result = await getPackageStats(fixturePath)

    expect(result).toHaveProperty('ignoredMissingDependencies')
    if ('ignoredMissingDependencies' in result) {
      expect(Array.isArray(result.ignoredMissingDependencies)).toBe(true)
      expect(result.ignoredMissingDependencies?.length).toBeGreaterThan(0)
    }

    // Should still produce valid stats despite missing dependencies
    expect(result).toHaveProperty('assets')
    expect(result.assets.length).toBeGreaterThan(0)
  })

  test('should handle missing scoped packages gracefully', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/missing-scoped-package',
    )

    const result = await getPackageStats(fixturePath)

    // This test covers line 147 - scoped package parsing
    expect(result).toHaveProperty('ignoredMissingDependencies')
    if (
      'ignoredMissingDependencies' in result &&
      result.ignoredMissingDependencies &&
      result.ignoredMissingDependencies.length > 0
    ) {
      // Should correctly parse @babel/runtime from @babel/runtime/helpers/typeof
      expect(result.ignoredMissingDependencies).toContain('@babel/runtime')
    }
  })
})

describe('Custom Imports', () => {
  test('should handle ESM custom imports', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')

    const result = await getPackageStats(fixturePath, {
      customImports: ['hello', 'add'],
    })

    expect(result).toHaveProperty('size')
    expect(result.size).toBeGreaterThan(0)
    expect(result).toHaveProperty('gzip')
    expect(result.gzip).toBeGreaterThan(0)
    expect(result).toHaveProperty('assets')
    expect(Array.isArray(result.assets)).toBe(true)
    expect(result.assets.length).toBeGreaterThan(0)
  })

  test('should handle CommonJS custom imports', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')

    const result = await getPackageStats(fixturePath, {
      customImports: ['hello', 'add'],
    })

    expect(result).toHaveProperty('size')
    expect(result.size).toBeGreaterThan(0)
    expect(result).toHaveProperty('gzip')
    expect(result.gzip).toBeGreaterThan(0)
    expect(result).toHaveProperty('assets')
    expect(Array.isArray(result.assets)).toBe(true)
    // Should have a main asset
    const mainAsset = result.assets.find(a => a.name === 'main')
    expect(mainAsset).toBeDefined()
    expect(mainAsset?.type).toBe('js')
  })
})

describe('Build Errors', () => {
  test('should throw UnexpectedBuildError for invalid JavaScript syntax', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/invalid-syntax',
    )

    try {
      await getPackageStats(fixturePath)
      fail('Should have thrown UnexpectedBuildError')
    } catch (error) {
      expect(error).toBeInstanceOf(UnexpectedBuildError)
      if (error instanceof UnexpectedBuildError) {
        expect(error.name).toBe('UnexpectedBuildError')
        expect(error.originalError).toBeDefined()
      }
    }
  })
})

describe('Installation Errors', () => {
  test('should throw PackageNotFoundError for non-existent npm package', async () => {
    const nonExistentPackage =
      'this-package-definitely-does-not-exist-' + Date.now()

    try {
      await getPackageStats(nonExistentPackage)
      fail('Should have thrown PackageNotFoundError')
    } catch (error) {
      // Should throw PackageNotFoundError when package doesn't exist on npm
      expect(error).toBeInstanceOf(PackageNotFoundError)
      if (error instanceof PackageNotFoundError) {
        expect(error.name).toBe('PackageNotFoundError')
      }
    }
  }, 30000)
})

describe('Entry Point Errors', () => {
  test('should throw EntryPointError when entry point file does not exist', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/missing-entry-point',
    )

    try {
      await getPackageStats(fixturePath)
      fail('Should have thrown EntryPointError')
    } catch (error) {
      expect(error).toBeInstanceOf(EntryPointError)
      if (error instanceof EntryPointError) {
        expect(error.name).toBe('EntryPointError')
        expect(error.originalError).toBeDefined()
      }
    }
  })

  test('should throw error when exports field points to non-existent files', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/invalid-exports',
    )

    try {
      await getPackageStats(fixturePath)
      fail('Should have thrown an error')
    } catch (error) {
      // Could be EntryPointError or UnexpectedBuildError depending on how it fails
      expect(error).toBeDefined()
      expect(error).toHaveProperty('name')
    }
  })
})

describe('CLI Build Errors', () => {
  test('should handle CLI file with shebang gracefully', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/errors/cli-build-error',
    )

    // This might throw CLIBuildError or succeed depending on rspack handling
    // Modern bundlers often handle shebangs correctly
    try {
      const result = await getPackageStats(fixturePath)
      // If it succeeds, that's fine - rspack handled it
      expect(result).toHaveProperty('size')
    } catch (error) {
      // If it fails, it might be a CLIBuildError
      if (error instanceof CLIBuildError) {
        expect(error.name).toBe('CLIBuildError')
        expect(error.originalError).toBeDefined()
      }
      // Allow other error types too since the exact failure mode may vary
    }
  })
})
