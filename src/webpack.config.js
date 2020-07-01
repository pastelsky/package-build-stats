const path = require('path')
const LessPluginCleanCSS = require('less-plugin-clean-css')
const LessPluginAutoprefixer = require('less-plugin-autoprefix')
const WriteFilePlugin = require('write-file-webpack-plugin')
const log = require('debug')('bp:webpack')
const escapeRegex = require('escape-string-regexp')
const webpack = require('webpack')

function makeWebpackConfig ({ entry, externals, debug }) {
  const externalsRegex = makeExternalsRegex(externals.externalPackages)
  const isExternalRequest = request => {
    const isPeerDep = externals.externalPackages.length
      ? externalsRegex.test(request)
      : false
    const isBuiltIn = externals.externalBuiltIns.includes(request)
    return isPeerDep || isBuiltIn
  }

  log('external packages %o', externalsRegex)

  const alias = {
    jquery: '@qubit/jquery',
    exit_checker: '@qubit/exit-checker'
  }

  return {
    entry: entry,
    profile: false,
    bail: false,
    amd: { jQuery: true },
    node: { // Disable all node shims or it fucks with global variables
      console: false,
      global: false,
      process: false,
      Buffer: false,
      __filename: 'mock',
      __dirname: 'mock',
      setImmediate: false
    },
    plugins: [
      new webpack.LoaderOptionsPlugin({
        options: {
          lessLoader: {
            lessPlugins: [
              new LessPluginAutoprefixer({ cascade: false }),
              new LessPluginCleanCSS()
            ]
          }
        }
      }),
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('production')
        }
      }),
      new webpack.IgnorePlugin(/^electron$/),
      ...(debug ? [new WriteFilePlugin()] : [])
    ],
    resolve: {
      extensions: ['.js', '.css'],
      modules: ['node_modules'],
      cacheWithContext: false,
      symlinks: false,
      alias
    },
    module: {
      loaders: [{
        include: [/.js$/],
        loader: 'buble',
        query: {
          objectAssign: '__assign__',
          transforms: {
            dangerousForOf: true,
            dangerousTaggedTemplateString: true
          },
          jsx: 'React.createElement'
        }
      }, {
        // Be very careful if you change this to include all CSS files, not just experience/aura ones.
        // It may break things where we are doing inline loaders (e.g. some of the deliver-lib modules).
        include: [/experiences\/experience-.+?\.css$/, /aura\/aura\.css$/],
        loader: 'css!less'
      }, {
        include: /\.json$/,
        loader: 'json'
      }]
    },
    resolveLoader: {
      modules: [
        path.join(__dirname, '..', 'loaders')
      ],
      alias: {
        '@qubit/css': 'css',
        '@qubit/text': 'text'
      }
    },
    output: {
      path: path.join(process.cwd(), 'dist'),
      filename: '[name].bundle.js',
      pathinfo: false
    },
    externals: (context, request, callback) =>
      isExternalRequest(request)
        ? callback(null, 'commonjs ' + request)
        : callback()
  }
}

function makeExternalsRegex (externals) {
  let externalsRegex = externals
    .map(dep => `^${escapeRegex(dep)}$|^${escapeRegex(dep)}\\/`)
    .join('|')

  externalsRegex = `(${externalsRegex})`

  return new RegExp(externalsRegex)
}

module.exports = makeWebpackConfig
