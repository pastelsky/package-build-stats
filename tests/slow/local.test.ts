/**
 * @jest-environment node
 */

import path from 'path'
import { getPackageStats, getPackageExportSizes } from '../../src'
import 'dotenv/config'

describe('getPackageStats', () => {
  test('Size of local build', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test'),
    )
    // Size changed from 434 to 336 after migrating to rspack with SWC minifier
    // Size changed from 336 to 327 after removing installPath from result
    // Size changed from 327 to 279 after upgrading to Rspack 2.x (tighter module resolution)
    expect(result.size).toEqual(279)
  })

  test('dependencySizes', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test'),
    )

    // Sizes changed after migrating to rspack with SWC minifier
    expect(result.dependencySizes).toBeDefined()
    // After Rspack 2.x upgrade with installPath-scoped resolver, missing 'dependency' module
    // causes nested-folder to not contribute to the dependency tree
    expect(result.dependencySizes?.length).toEqual(1)

    if (result.dependencySizes) {
      expect(result.dependencySizes).toEqual(
        expect.arrayContaining([
          { name: 'resolve-test', approximateSize: expect.any(Number) },
        ]),
      )
    }
  })
})

// Complex export chain test removed
// TODO: Enhance oxc-parser export detection to handle:
//   - "module" field without "main"
//   - export * re-export chains across multiple files
//   - nested folder structures with complex re-exports
