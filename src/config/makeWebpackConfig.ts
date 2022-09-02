import autoprefixer from 'autoprefixer'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssoWebpackPlugin from 'csso-webpack-plugin'
import WriteFilePlugin from 'write-file-webpack-plugin'

const log = require('debug')('bp:webpack')
import escapeRegex from 'escape-string-regexp'
import webpack, { Entry } from 'webpack'
import { ESBuildMinifyPlugin } from 'esbuild-loader'
import { VueLoaderPlugin } from 'vue-loader'

import { Externals } from '../common.types'

type MakeWebpackConfigOptions = {
  packageName: string
  externals: Externals
  debug?: boolean
  entry: string | string[] | Entry
  minifier: 'esbuild' | 'terser'
}

export default function makeWebpackConfig({
  entry,
  externals,
  debug,
  minifier,
}: MakeWebpackConfigOptions): webpack.Configuration {
  const externalsRegex = makeExternalsRegex(externals.externalPackages)
  const isExternalRequest = (request: string) => {
    const isPeerDep = externals.externalPackages.length
      ? externalsRegex.test(request)
      : false
    const isBuiltIn = externals.externalBuiltIns.includes(request)
    return isPeerDep || isBuiltIn
  }

  log('external packages %o', externalsRegex)

  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  return {
    entry: entry,
    mode: 'production',
    // bail: true,
    optimization: {
      chunkIds: 'named',
      runtimeChunk: 'multiple',
      minimize: true,
      splitChunks: {
        cacheGroups: {
          styles: {
            name: 'main',
            test: /\.css$/,
            chunks: 'all',
            enforce: true,
          },
        },
      },
      // @ts-ignore: Appears that the library CssoWebpackPlugin might have incorrect definitions
      minimizer: [
        ...(minifier === 'terser'
          ? ['...']
          : [
              new ESBuildMinifyPlugin({
                target: 'esnext',
              }),
            ]),
        new CssoWebpackPlugin({ restructure: false }),
      ],
    },
    plugins: [
      new webpack.IgnorePlugin({ resourceRegExp: /^electron$/ }),
      new VueLoaderPlugin(),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: '[name].bundle.css',
        chunkFilename: '[id].bundle.css',
      }),
      ...(debug ? ([new WriteFilePlugin()] as any) : []),
    ],
    resolve: {
      modules: ['node_modules'],
      cacheWithContext: false,
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
      mainFields: ['browser', 'import', 'module', 'main', 'style'],
      conditionNames: ['browser', 'import', 'module', 'main', 'style'],
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: require.resolve('vue-loader'),
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, require.resolve('css-loader')],
        },
        // see https://github.com/apollographql/react-apollo/issues/1737
        {
          type: 'javascript/auto',
          test: /\.mjs$/,
          use: [],
        },
        {
          test: /\.js$/,
          use: [
            // support CLI tools that start with a #!/usr/bin/node
            require.resolve('shebang-loader'),
            // ESBuild Minifier doesn't auto-remove license comments from code
            // So, we break ESBuild's heuristic for license comments match. See github.com/privatenumber/esbuild-loader/issues/87
            {
              loader: require.resolve('string-replace-loader'),
              options: {
                multiple: [
                  { search: '@license', replace: '@silence' },
                  { search: /\/\/!/g, replace: '//' },
                  { search: /\/\*!/g, replace: '/*' },
                ],
              },
            },
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
        {
          test: /\.(scss|sass)$/,
          use: [
            MiniCssExtractPlugin.loader,
            require.resolve('css-loader'),
            {
              loader: require.resolve('postcss-loader'),
              options: {
                plugins: () => [autoprefixer()],
              },
            },
            require.resolve('sass-loader'),
          ],
        },
        {
          test: /\.less$/,
          use: [
            MiniCssExtractPlugin.loader,
            require.resolve('css-loader'),
            {
              loader: require.resolve('postcss-loader'),
              options: {
                plugins: () => [
                  autoprefixer({
                    browsers: [
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
            {
              loader: require.resolve('less-loader'),
              options: {
                webpackImporter: true,
              },
            },
          ],
        },
        {
          test: /\.(woff|woff2|eot|ttf|svg|png|jpeg|jpg|gif|webp)$/,
          loader: require.resolve('file-loader'),
          options: {
            name: '[name].bundle.[ext]',
            emitFile: true,
          },
        },
      ],
    },
    node: false,
    output: {
      filename: '[name].bundle.js',
      chunkFilename: '[name].bundle.js',
      pathinfo: false,
    },
    externals: (context, callback) =>
      context.request && isExternalRequest(context.request)
        ? callback(undefined, 'commonjs ' + context.request)
        : callback(),
  }
}

function makeExternalsRegex(externals: string[]) {
  let externalsRegex = externals
    .map(dep => `^${escapeRegex(dep)}$|^${escapeRegex(dep)}\\/`)
    .join('|')

  externalsRegex = `(${externalsRegex})`

  return new RegExp(externalsRegex)
}
