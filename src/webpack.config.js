const autoprefixer = require('autoprefixer')
const TerserPlugin = require('terser-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssoWebpackPlugin = require('csso-webpack-plugin').default
const WriteFilePlugin = require('write-file-webpack-plugin')
const log = require('debug')('bp:webpack')
const escapeRegex = require('escape-string-regexp')
const builtinModules = require('builtin-modules')
const webpack = require('webpack')

function makeWebpackConfig({ entry, externals, debug }) {
  const externalsRegex = makeExternalsRegex(externals.externalPackages)
  const isExternalRequest = request => {
    const isPeerDep = externals.externalPackages.length
      ? externalsRegex.test(request)
      : false
    const isBuiltIn = externals.externalBuiltIns.includes(request)
    return isPeerDep || isBuiltIn
  }

  log('external packages %o', externalsRegex)

  const builtInNode = {}
  builtinModules.forEach(mod => {
    builtInNode[mod] = 'empty'
  })

  builtInNode['setImmediate'] = false
  builtInNode['console'] = false
  builtInNode['process'] = false
  builtInNode['Buffer'] = false

  const mainFields = ['browser', 'module', 'main', 'style'];

  return {
    entry: entry,
    mode: 'production',
    // bail: true,
    optimization: {
      namedChunks: true,
      runtimeChunk: { name: 'runtime' },
      minimize: !debug,
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
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            ie8: false,
            output: {
              comments: false,
            },
          },
        }),
        new CssoWebpackPlugin({ restructure: false }),
      ],
    },
    plugins: [
      new webpack.IgnorePlugin(/^electron$/),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: '[name].bundle.css',
        chunkFilename: '[id].bundle.css',
      }),
      ...(debug ? [new WriteFilePlugin()] : [])
    ],
    resolve: {
      modules: ['node_modules'],
      symlinks: false,
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
      mainFields,
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        // see https://github.com/apollographql/react-apollo/issues/1737
        {
          type: 'javascript/auto',
          test: /\.mjs$/,
          resolve: { mainFields },
          use: [],
        },
        {
          test: /\.js$/,
          use: ['shebang-loader'], // support CLI tools that start with a #!/usr/bin/node
        },
        {
          test: /\.(scss|sass)$/,
          loader: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            {
              loader: 'postcss-loader',
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
            'sass-loader',
          ],
        },
        {
          test: /\.(woff|woff2|eot|ttf|svg|png|jpeg|jpg|gif|webp)$/,
          loader: 'file-loader',
          query: {
            emitFile: true,
          },
        },
      ],
    },
    node: builtInNode,
    output: {
      filename: 'bundle.js',
      pathinfo: false,
    },
    externals: (context, request, callback) =>
      isExternalRequest(request)
        ? callback(null, 'commonjs ' + request)
        : callback(),
  }
}

function makeExternalsRegex(externals) {
  let externalsRegex = externals
    .map(dep => `^${escapeRegex(dep)}$|^${escapeRegex(dep)}\\/`)
    .join('|')

  externalsRegex = `(${externalsRegex})`

  return new RegExp(externalsRegex)
}

module.exports = makeWebpackConfig
