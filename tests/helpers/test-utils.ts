/**
 * Test utilities and helpers for package-build-stats tests
 */

import path from 'path'
import getPackageStats from '../../src/getPackageStats'
import { getPackageExportSizes } from '../../src/getPackageExportSizes'
import './custom-matchers'

/**
 * Get the absolute path to a fixture
 */
export function getFixturePath(category: string, name: string): string {
  return path.resolve(__dirname, '../fixtures', category, name)
}

/**
 * Build a fixture and return stats
 * Uses local path which is automatically detected by the package
 */
export async function buildFixture(
  category: string,
  name: string,
  options: any = {},
) {
  const fixturePath = getFixturePath(category, name)
  // Package automatically detects local paths (starts with ./ or absolute path)
  // and uses InstallationUtils.installPackage with isLocal: true
  return getPackageStats(fixturePath, {
    ...options,
    debug: false,
  })
}

/**
 * Build a fixture and get export sizes
 * Uses local path which is automatically detected by the package
 */
export async function buildFixtureExports(
  category: string,
  name: string,
  options: any = {},
) {
  const fixturePath = getFixturePath(category, name)
  // Package automatically detects local paths
  return getPackageExportSizes(fixturePath, {
    ...options,
    debug: false,
  })
}

/**
 * Assert that a size is within a reasonable range
 */
export function expectSizeInRange(
  actual: number,
  expected: number,
  tolerance: number = 0.2,
) {
  const min = expected * (1 - tolerance)
  const max = expected * (1 + tolerance)
  expect(actual).toBeGreaterThanOrEqual(min)
  expect(actual).toBeLessThanOrEqual(max)
}

/**
 * Assert that a size is positive and reasonable
 */
export function expectValidSize(size: number, maxSize: number = 100000) {
  expect(size).toBeGreaterThan(0)
  expect(size).toBeLessThan(maxSize)
}

/**
 * Assert that gzip size is less than original size
 */
export function expectValidGzip(size: number, gzip: number) {
  expect(gzip).toBeGreaterThan(0)
  expect(gzip).toBeLessThanOrEqual(size)
}

/**
 * Assert that assets array is valid
 */
export function expectValidAssets(
  assets: any[],
  minCount: number = 1,
  maxCount: number = 10,
) {
  expect(assets).toBeDefined()
  expect(Array.isArray(assets)).toBe(true)
  expect(assets.length).toBeGreaterThanOrEqual(minCount)
  expect(assets.length).toBeLessThanOrEqual(maxCount)

  assets.forEach(asset => {
    expect(asset).toHaveProperty('name')
    expect(asset).toHaveProperty('type')
    expect(asset).toHaveProperty('size')
    expect(asset).toHaveProperty('gzip')
    expectValidSize(asset.size)
    expectValidGzip(asset.size, asset.gzip)
  })
}

/**
 * Test timeout helper for slow operations
 */
export const TEST_TIMEOUT = {
  FAST: 5000, // 5 seconds
  MEDIUM: 30000, // 30 seconds
  SLOW: 60000, // 1 minute
}
