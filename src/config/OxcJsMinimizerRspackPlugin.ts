import { Compilation, sources } from '@rspack/core'
import type { Compiler, RspackPluginInstance } from '@rspack/core'
import { minify } from 'oxc-minify'
import PQueue from 'p-queue'

const PLUGIN_NAME = 'OxcJsMinimizerRspackPlugin'
const JAVASCRIPT_ASSET = /\.[cm]?js$/

export default class OxcJsMinimizerRspackPlugin implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, compilation => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async () => {
          const queue = new PQueue({ concurrency: 4 })
          const assets = compilation
            .getAssets()
            .filter(
              asset =>
                JAVASCRIPT_ASSET.test(asset.name) && !asset.info.minimized,
            )

          const minifications = await Promise.allSettled(
            assets.map(asset =>
              queue.add(async () => {
                const originalCode = asset.source.source().toString()
                const result = await minify(asset.name, originalCode, {
                  compress: true,
                  mangle: true,
                  codegen: {
                    legalComments: 'none',
                    removeWhitespace: true,
                  },
                })

                if (result.errors.length > 0) {
                  throw new Error(
                    `Oxc could not minify ${asset.name}:\n${result.errors
                      .map(error => error.message)
                      .join('\n')}`,
                  )
                }

                compilation.updateAsset(
                  asset.name,
                  new sources.RawSource(result.code),
                  assetInfo => ({
                    ...assetInfo,
                    minimized: true,
                  }),
                )
              }),
            ),
          )

          const failedMinification = minifications.find(
            result => result.status === 'rejected',
          )
          if (failedMinification?.status === 'rejected') {
            throw failedMinification.reason
          }
        },
      )
    })
  }
}
