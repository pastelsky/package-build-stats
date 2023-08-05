const path = require('path')
/**
 * @jest-environment node
 */

const { getPackageStats } = require('../src')
const { getPackageExportSizes } = require('../src')

require('dotenv').config()

jest.setTimeout(15000)
describe('getPackageStats', () => {
  test('Size of local build', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test')
    )
    expect(result.size).toEqual(636)
  })

  test('dependencySizes', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test')
    )

    expect(result.dependencySizes.length).toEqual(2)
    expect(result.dependencySizes).toEqual(
      expect.arrayContaining([{ name: 'resolve-test', approximateSize: 575 }])
    )
    expect(result.dependencySizes).toEqual(
      expect.arrayContaining([
        {
          name: 'resolve-test/nested-folder/another-nested-folder',
          approximateSize: 85,
        },
      ])
    )
  })
})

describe('getPackageExportSizes', () => {
  test('Output of local build', async () => {
    const result = await getPackageExportSizes(
      path.resolve('./fixtures/node_modules/resolve-test')
    )
    expect(result.assets.length).toEqual(5)
    expect(result.assets[0].path).toEqual('another-file-1.js')
  })
})
