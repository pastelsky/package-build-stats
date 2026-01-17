import autoprefixer from 'autoprefixer'


import escapeRegex from 'escape-string-regexp'
import type { Entry, Configuration } from '@rspack/core'
import rspack from '@rspack/core'

import { Externals } from '../common.types'

type MakeRspackConfigOptions = {
  packageName: string
  externals: Externals
  debug?: boolean
  minify?: boolean
  entry: Entry
}

export default function makeRspackConfig({
  packageName: _packageName,
  entry,
  externals,
  debug: _debug,
  minify = true,
}: MakeRspackConfigOptions): Configuration {
  const externalsRegex = makeExternalsRegex(externals.externalPackages)
  const isExternalRequest = (request: string) => {
    const isPeerDep = externals.externalPackages.length
      ? externalsRegex.test(request)
      : false
    const isBuiltIn = externals.externalBuiltIns.includes(request)
    return isPeerDep || isBuiltIn
  }



  const configuration: Configuration = {
    entry: entry,
    mode: 'production',
    devtool: _debug ? 'source-map' : false,
    optimization: {
      runtimeChunk: { name: 'runtime' },
      realContentHash: false,
      minimize: minify,
      // Rspack automatically uses its built-in default minifiers:
      // - SwcJsMinimizerRspackPlugin for JS (SWC-based, very fast)
      // - LightningCssMinimizerRspackPlugin for CSS (Lightning CSS-based)
      // See: https://rspack.rs/guide/optimization/production
      splitChunks: {
        cacheGroups: {
          styles: {
            name: 'main',
            test: /\.css$/,
            chunks: 'all',
          },
        },
      },
    },
    stats: {
      source: true,
      modules: true,
      nestedModules: true,
      reasons: true,
      depth: true,
      chunkModules: true,
    },
    resolve: {
      modules: ['node_modules'],
      extensions: [
        '.web.mjs',
        '.mjs',
        '.web.js',
        '.js',
        '.mjs',
        '.json',
        '.css',
        '.sass',
        '.scss',
      ],
      mainFields: ['browser', 'module', 'main', 'style'],
    },
    module: {
      rules: [
        {
          type: 'javascript/auto',
          test: /\.mjs$/,
          use: [],
        },
        {
          test: /\.css$/,
          type: 'javascript/auto',
          use: [
            rspack.CssExtractRspackPlugin.loader,
            require.resolve('css-loader'),
          ],
        },
        {
          test: /\.(html|svelte)$/,
          use: {
            loader: require.resolve('svelte-loader'),
            options: {
              emitCss: true,
            },
          },
        },
        // {
        //   test: /\.vue$/,
        //   loader: require.resolve('vue-loader'),
        // },
        {
          test: /\.(scss|sass)$/,
          type: 'javascript/auto',
          use: [
            rspack.CssExtractRspackPlugin.loader,
            require.resolve('css-loader'),
            {
              loader: require.resolve('postcss-loader'),
              options: {
                postcssOptions: {
                  plugins: [autoprefixer()],
                },
              },
            },
            require.resolve('sass-loader'),
          ],
        },
        {
          test: /\.less$/,
          type: 'javascript/auto',
          use: [
            rspack.CssExtractRspackPlugin.loader,
            require.resolve('css-loader'),
            {
              loader: require.resolve('postcss-loader'),
              options: {
                postcssOptions: {
                  plugins: [
                    autoprefixer({
                      overrideBrowserslist: [
                        'last 5 Chrome versions',
                        'last 5 Firefox versions',
                        'Safari >= 8',
                        'Explorer >= 10',
                        'edge >= 12',
                      ],
                    }),
                  ],
                },
              },
            },
            {
              loader: require.resolve('less-loader'),
              options: {
                lessOptions: {
                  javascriptEnabled: true,
                },
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new rspack.CssExtractRspackPlugin({
        filename: '[name].bundle.css',
      }),
    ],

    node: {
      global: false,
    },
    output: {
      filename: '[name].bundle.js',
    },
    externals: ({ request }, callback) =>
      isExternalRequest(request || '')
        ? callback(undefined, 'commonjs ' + request)
        : callback(undefined),
  }

  return configuration
}

function makeExternalsRegex(externals: string[]) {
  let externalsRegex = externals
    .map(dep => `^${escapeRegex(dep)}$|^${escapeRegex(dep)}\\/`)
    .join('|')

  externalsRegex = `(${externalsRegex})`

  return new RegExp(externalsRegex)
}
