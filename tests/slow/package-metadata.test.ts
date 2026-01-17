/**
 * @jest-environment node
 *
 * Tests for package.json metadata extraction and parsing
 */

import path from 'path'
import { getPackageStats } from '../../src'

describe('Package Metadata Extraction', () => {
  test('should extract package.json details', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result).toHaveProperty('dependencyCount')
    expect(result).toHaveProperty('hasJSNext')
    expect(result).toHaveProperty('hasJSModule')
    expect(result).toHaveProperty('hasSideEffects')
  })

  test('should count dependencies', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    // simple-esm has no dependencies
    expect(result.dependencyCount).toBe(0)
  })

  test('should detect peerDependencies', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result).toHaveProperty('peerDependencies')
    expect(Array.isArray(result.peerDependencies)).toBe(true)
  })

  test('should detect hasSideEffects field', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    // If sideEffects field is not present, defaults to true
    expect(typeof result.hasSideEffects).toBe('boolean')
  })
})

describe('Module Type Detection', () => {
  test('should detect ESM type from "type": "module"', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result.isModuleType).toBe(true)
  })

  test('should default to CJS when no type field', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')
    const result = await getPackageStats(fixturePath)

    expect(result.isModuleType).toBe(false)
  })

  test('should detect module field', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result).toHaveProperty('hasJSModule')
  })

  test('should detect jsnext:main field', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result).toHaveProperty('hasJSNext')
  })
})

describe('Package Structure', () => {
  test('should handle packages without dependencies', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = await getPackageStats(fixturePath)

    expect(result.dependencyCount).toBe(0)
    expect(result.peerDependencies).toEqual([])
  })

  test('should handle packages without peerDependencies', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')
    const result = await getPackageStats(fixturePath)

    expect(result.peerDependencies).toEqual([])
  })
})
