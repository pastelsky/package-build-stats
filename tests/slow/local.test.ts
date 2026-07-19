/**
 * @jest-environment node
 */

import path from 'path'
import { getPackageStats } from '../../src'
import 'dotenv/config'

describe('getPackageStats', () => {
  test('Size of local build', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test'),
    )
    expect(result.size).toEqual(323)
  })

  test('dependencySizes', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test'),
    )

    expect(result.dependencySizes).toBeDefined()
    expect(result.dependencySizes?.length).toEqual(2)

    if (result.dependencySizes) {
      expect(result.dependencySizes).toEqual(
        expect.arrayContaining([
          { name: 'resolve-test', approximateSize: 516 },
        ]),
      )
      expect(result.dependencySizes).toEqual(
        expect.arrayContaining([
          {
            name: 'resolve-test/nested-folder/another-nested-folder',
            approximateSize: 128,
          },
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
