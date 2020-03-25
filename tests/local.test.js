const path = require('path')
/**
 * @jest-environment node
 */

const getPackageStats = require('../src/getPackageStats.js')
const { getPackageExportSizes } = require('../src/getPackageExportSizes')

require('dotenv').config()

describe('getPackageStats', () => {
  test('Size of local build', async done => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test')
    )
    expect(result.size).toEqual(425)
    done()
  })
  test('dependencySizes', async done => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test')
    )
    expect(result.dependencySizes.length).toEqual(2)
    expect(result.dependencySizes[0].name).toEqual(
      'resolve-test/nested-folder/another-nested-folder'
    )
    expect(result.dependencySizes[1].name).toEqual('resolve-test')
    done()
  })
})

describe('getPackageExportSizes', () => {
  test('Output of local build', async done => {
    const result = await getPackageExportSizes(
      path.resolve('./fixtures/node_modules/resolve-test')
    )
    expect(result.assets.length).toEqual(4)
    expect(result.assets[0].path).toEqual('another-file-1.js')
    done()
  })
})
