const autoprefixer = require('autoprefixer')
const TerserPlugin = require('terser-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const CssoWebpackPlugin = require('csso-webpack-plugin').default
const WriteFilePlugin = require('write-file-webpack-plugin')
const debug = require("debug")("bp:webpack")
const escapeRegex = require('escape-string-regexp')
const builtinModules = require('builtin-modules')
const webpack = require("webpack")


function makeWebpackConfig({ entryPoint, externals }) {
  const externalsRegex = makeExternalsRegex(externals)
  debug('externals %o', externalsRegex);

  const builtInNode = {}
  builtinModules.forEach(mod => {
    builtInNode[mod] = 'empty'
  })

  builtInNode['setImmediate'] = false
  builtInNode['console'] = false
  builtInNode['process'] = false
  builtInNode['Buffer'] = false

  return {
    entry: {
      main: entryPoint
    },
    mode: "production",
    // bail: true,
    optimization: {
      namedChunks: true,
      runtimeChunk: { name: "runtime" },
      splitChunks: {
        cacheGroups: {
          styles: {
            name: 'main',
            test: /\.css$/,
            chunks: 'all',
            enforce: true
          }
        }
      },
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            ecma: 8,
            ie8: false,
            output: {
              comments: false,
            }
          }
        }),
        new CssoWebpackPlugin({ restructure: false }),
      ],
    },
    plugins: [
      new webpack.IgnorePlugin(/^electron$/),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: "[name].bundle.css",
        chunkFilename: "[id].bundle.css"
      }),
      // new WriteFilePlugin()
    ],
    resolve: {
      modules: ["node_modules"],
      symlinks: false,
      cacheWithContext: false,
      extensions: ['.web.mjs', '.mjs', '.web.js', '.js', '.mjs', '.json', '.css', '.sass', '.scss'],
      mainFields: ['browser', 'module', 'main', 'style'],
    },
    module: {
      noParse: [/\.min\.js/],
      rules: [
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        // see https://github.com/apollographql/react-apollo/issues/1737
        {
          type: 'javascript/auto',
          test: /\.mjs$/,
          use: []
        },
        {
          test: /\.(scss|sass)$/,
          loader: [
            MiniCssExtractPlugin.loader,
            'css-loader', {
              loader: 'postcss-loader',
              options: {
                plugins: () => [
                  autoprefixer({
                    browsers: [
                      "last 5 Chrome versions",
                      "last 5 Firefox versions",
                      "Safari >= 8",
                      "Explorer >= 10",
                      "edge >= 12"
                    ]
                  })
                ]
              }
            },
            'sass-loader'
          ]
        },
        {
          test: /\.(woff|woff2|eot|ttf|svg|png|jpeg|jpg|gif|webp)/,
          loader: 'file-loader',
          query: {
            emitFile: true,
          },
        },
      ]
    },
    node: builtInNode,
    output: {
      filename: "bundle.js",
      pathinfo: true,
    },
    externals: externals.length ? (
      function (context, request, callback) {
        if (externalsRegex.test(request)) {
          return callback(null, 'commonjs ' + request)
        }
        callback()
      }
    ) : []
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