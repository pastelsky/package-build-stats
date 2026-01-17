/**
 * @jest-environment node
 *
 * Tests for basic module types: ESM, CommonJS, and mixed module systems
 */

import path from 'path'
import { getPackageStats } from '../../src'

describe('ESM Modules', () => {
  test('should build pure ESM module', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    // Size assertions with specific ranges (simple ESM fixture ~280-350 bytes)
    expect(result.size).toBeBetween(250, 400)
    expect(result.gzip).toBeBetween(180, 300)

    // Asset structure assertions
    expect(result.assets).toHaveLength(1)
    const jsAsset = result.assets[0]
    expect(jsAsset.name).toBe('main')
    expect(jsAsset.type).toBe('js')
    expect(jsAsset.size).toBe(result.size)
    expect(jsAsset.gzip).toBe(result.gzip)
  })

  test('should not have dependencies', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result.dependencyCount).toBe(0)
  })

  test('should detect ESM type from package.json', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    // simple-esm has "type": "module"
    expect(result.isModuleType).toBe(true)
  })
})

describe('CommonJS Modules', () => {
  test('should build CommonJS module', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')
    const result = await getPackageStats(fixturePath)

    // Size assertions with specific ranges (simple CJS fixture ~280-330 bytes)
    expect(result.size).toBeBetween(250, 380)
    expect(result.gzip).toBeBetween(180, 280)

    // Asset structure assertions
    expect(result.assets).toHaveLength(1)
    const jsAsset = result.assets[0]
    expect(jsAsset.name).toBe('main')
    expect(jsAsset.type).toBe('js')
  })

  test('should handle module.exports syntax', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')
    const result = await getPackageStats(fixturePath)

    // Specific value assertions
    expect(result.size).toBeBetween(250, 380)
    expect(result.dependencyCount).toBe(0)
    expect(result.assets).toHaveLength(1)
  })

  test('should default to CJS type when no type field', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')
    const result = await getPackageStats(fixturePath)

    // simple-cjs has no "type" field, defaults to CommonJS
    expect(result.isModuleType).toBe(false)
  })
})

describe('Mixed Module Systems', () => {
  test('should handle mixed ESM and CJS in same package', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/basic/mixed-modules',
    )
    const result = await getPackageStats(fixturePath)

    // Size assertions with specific ranges (mixed modules ~550-620 bytes)
    expect(result.size).toBeBetween(500, 700)
    expect(result.gzip).toBeBetween(280, 420)

    // Asset structure assertions
    expect(result.assets).toHaveLength(1)
    const jsAsset = result.assets[0]
    expect(jsAsset.name).toBe('main')
    expect(jsAsset.type).toBe('js')
  })

  test('should resolve .mjs extensions', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/basic/mixed-modules',
    )
    const result = await getPackageStats(fixturePath)

    // Specific assertions
    expect(result.size).toBeBetween(500, 700)
    expect(result.dependencyCount).toBe(0)
    expect(result.assets).toHaveLength(1)
  })

  test('should allow require() of .mjs files', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/basic/mixed-modules',
    )
    const result = await getPackageStats(fixturePath)

    // Should successfully bundle without errors
    expect(result.size).toBeBetween(500, 700)
    expect(result.assets).toHaveLength(1)
    expect(result.assets[0].type).toBe('js')
  })
})
