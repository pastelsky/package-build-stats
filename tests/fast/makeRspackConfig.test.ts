import { describe, expect, test } from 'vitest'

import makeRspackConfig from '../../src/config/makeRspackConfig.js'

describe('makeRspackConfig', () => {
  test('uses the bundle filename convention for emitted assets', () => {
    const config = makeRspackConfig({
      packageName: 'fixture',
      entry: '/tmp/index.js',
      externals: {
        externalPackages: [],
        externalBuiltIns: [],
      },
      outputPath: '/tmp/output',
    })

    expect(config.output?.assetModuleFilename).toBe('[name].bundle.[ext]')
    expect(config.output?.webassemblyModuleFilename).toBe('[name].bundle.wasm')
  })
})
