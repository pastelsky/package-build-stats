import { describe, expect, test } from 'vitest'

import makeRspackConfig from '../../src/config/makeRspackConfig.js'

describe('makeRspackConfig', () => {
  test('uses bundle naming for emitted asset modules', () => {
    const config = makeRspackConfig({
      packageName: 'demo-package',
      externals: {
        externalPackages: [],
        externalBuiltIns: [],
      },
      entry: {
        main: '/tmp/demo-package/index.js',
      },
      outputPath: '/tmp/demo-package/dist',
    })

    expect(config.output).toMatchObject({
      filename: '[name].bundle.js',
      assetModuleFilename: '[name].[contenthash:8].bundle[ext]',
      path: '/tmp/demo-package/dist',
    })
  })
})
