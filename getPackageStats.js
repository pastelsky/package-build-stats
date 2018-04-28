/**
 * Code heavily inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

const fs = require("fs")
const path = require("path")
const { gzipSync } = require("zlib")
const debug = require("debug")("bp:worker")
const pify = require('pify')
const autoprefixer = require('autoprefixer')
//
const webpack = require("webpack")
const MemoryFS = require("memory-fs")
const rimraf = require('rimraf')
const UglifyJSPlugin = require("webpack-parallel-uglify-plugin")
//
const { exec, getExternals, parsePackageString } = require("./utils/server.utils")
const getParseTime = require('./getParseTime')
const mkdir = require('mkdir-promise')
const config = require('./config')
const CustomError = require("./CustomError")
//const WriteFilePlugin = require('write-file-webpack-plugin')
const ExtractTextPlugin = require("extract-text-webpack-plugin")
const sanitize = require("sanitize-filename")
const builtinModules = require('builtin-modules')


function getInstallPath(packageName) {
  return path.join(config.tmp, 'packages', sanitize(`build-${packageName}`))
}

function getEntryPoint(name, installPath) {
  const entryPath = path.join(
    installPath,
    'index.js'
  )

  try {
    fs.writeFileSync(
      entryPath,
      `const p  = require('${name}'); console.log(p)`,
      "utf-8"
    )
    return entryPath
  } catch (err) {
    throw new CustomError("EntryPointError", err)
  }
}

function installPackage(
  packageName,
  installPath,
  { client, limitConcurrency, networkConcurrency }
) {
  let flags, command

  if (client === 'yarn') {
    flags = ['ignore-flags', 'ignore-engines', 'skip-integrity-check', 'exact',
             'json', 'no-progress', 'silent', 'no-lockfile', 'no-bin-links',
             'ignore-optional']
    if (limitConcurrency) {
      flags.push('mutex network')
    }

    if (networkConcurrency) {
      flags.push(`network-concurrency ${networkConcurrency}`)
    }
    command = `yarn add ${packageName} --${flags.join(" --")}`
  } else {
    flags = [
      // Setting cache is required for concurrent `npm install`s to work
      `cache=${path.join(config.tmp, "cache")}`,
      "no-package-lock",
      "no-shrinkwrap",
      "no-optional",
      "no-bin-links",
      "prefer-offline",
      "progress false",
      "loglevel error",
      "ignore-scripts",
      "save-exact",
      //"fetch-retry-factor 0",
      //"fetch-retries 0",
      "json"
    ]

    command = `npm install ${packageName} --${flags.join(" --")}`
  }

  debug("install start %s", packageName)
  return exec(command, {
    cwd: installPath
  })
    .then(() => {
      debug("install finish %s", packageName)
    })
    .catch(err => {
      if (err.includes('code E404')) {
        throw new CustomError("PackageNotFoundError", err)
      } else {
        throw new CustomError("InstallError", err)
      }
    })
}

function buildPackage(name, installPath, externals, options) {
  const entryPoint = getEntryPoint(name, installPath)

  const builtInNode = {}
  builtinModules.forEach(mod => {
    builtInNode[mod] = 'empty'
  })

  builtInNode['setImmediate'] =  false
  builtInNode['console'] = false
  builtInNode['process'] = true

  const compiler = webpack({
    entry: entryPoint,
    //bail: true,
    //target: "web",
    plugins: [
      new webpack.DefinePlugin({
        "process.env": {
          NODE_ENV: JSON.stringify("production")
        }
      }),
      new webpack.IgnorePlugin(/^electron$/),
      // Removes webpack's bootstrap code so
      // it doesn't get added in a package's size
      new webpack.optimize.CommonsChunkPlugin({
        name: 'commons',
        filename: 'commons.js',
        minChunks: Infinity
      }),
      new webpack.LoaderOptionsPlugin({ minimize: true }),
      new ExtractTextPlugin("bundle.css"),
      //new WriteFilePlugin(),
      new UglifyJSPlugin({
        workerCount: require('os').cpus().length,
        uglifyES: {
          ie8: false
        }
      })
    ],
    resolve: {
      modules: ["node_modules"],
      symlinks: false,
      cacheWithContext: false
    },
    module: {
      noParse: [/\.min\.js/],
      rules: [
        {
          test: /\.css$/,
          use: ExtractTextPlugin.extract({ use: "css-loader" })
        },
        {
          test: /\.(scss|sass)$/,
          loader: ExtractTextPlugin.extract({
            use: [
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
          })
        }, {
          test: /\.(woff|woff2|ttf|svg|png|jpeg|jpg|gif|webp)/,
          loader: 'file-loader',
          query: {
            emitFile: true,
          },
        },
      ]
    },
    node: builtInNode,
    output: {
      filename: "bundle.js"
    },
    externals: externals ? (
      function (context, request, callback) {

        if (externals.test(request)) {
          return callback(null, 'commonjs ' + request)
        }
        callback()
      }
    ) : []
  })

  const memoryFileSystem = new MemoryFS()
  compiler.outputFileSystem = memoryFileSystem

  return new Promise((resolve, reject) => {
      debug("build start %s", name)
      compiler.run((err, stats) => {
        debug("build end %s", name)

        // stats object can be empty if there are build errors
        let jsonStats = stats ? stats.toJson() : {}

        if ((err && err.details) && !stats) {
          reject(new CustomError("BuildError", err.details, {
            name: err.name,
            message: err.error
          }))
        } else if (stats.compilation.errors && stats.compilation.errors.length) {
          const missingModuleErrors = stats.compilation.errors
            .filter(error => error.name === 'ModuleNotFoundError')

          if (missingModuleErrors.length) {
            // There's a better way to get the missing module's name, maybe ?
            const missingModuleRegex = /Can't resolve '(.+)' in/

            const missingModules = missingModuleErrors.map(err => {
              const matches = err.error.toString().match(missingModuleRegex)
              return matches[1]
            })

            const uniqueMissingModules = Array.from(new Set(missingModules))

            // If the only missing dependency is the package itself,
            // it means that no valid entry points were found
            if (uniqueMissingModules.length === 1 && uniqueMissingModules[0] === name) {
              reject(new CustomError(
                "EntryPointError",
                stats.compilation.errors.map(err => err.toString())
                )
              )
            } else {
              reject(new CustomError(
                "MissingDependencyError",
                stats.compilation.errors.map(err => err.toString()),
                { missingModules: Array.from(new Set(missingModules)) }
                )
              )
            }
          } else if (jsonStats.errors && (jsonStats.errors.length > 0)) {
            reject(new CustomError("BuildError", jsonStats.errors))
          }
        } else {
          const isCSSAsset = jsonStats.assets.some(
            asset => asset.name.endsWith('.css'))
          const bundleName = isCSSAsset ? 'bundle.css' : 'bundle.js'
          const size = jsonStats.assets
            .filter(x => x.name === bundleName)
            .pop()
            .size

          const bundle = path.join(process.cwd(), bundleName)
          const bundleContents = memoryFileSystem.readFileSync(bundle)
          let parseTimes = {}
          if (options.calcParse) {
            parseTimes = getParseTime(bundleContents)
          }
          const gzip = gzipSync(bundleContents, {}).length

          debug("build result %O", { size, gzip })
          resolve({ size, gzip, parse: parseTimes })
        }
      })
    }
  )
}

function getPackageJSONDetails(packageName, installPath) {
  const packageJSONPath = path.join(installPath, 'node_modules', packageName, 'package.json')
  return pify(fs.readFile)(packageJSONPath, 'utf8')
    .then(contents => {
      const parsedJSON = JSON.parse(contents)
      return {
        dependencyCount: 'dependencies' in parsedJSON ?
          Object.keys(parsedJSON.dependencies).length : 0,
        hasJSNext: parsedJSON['jsnext:main'] || false,
        hasJSModule: parsedJSON['module'] || false,
        hasSideEffects: 'sideEffects' in parsedJSON ?
          parsedJSON['sideEffects'] : true,
        peerDependencies: 'peerDependencies' in parsedJSON ?
          Object.keys(parsedJSON.peerDependencies) : []
      }
    })
}

function getPackageStats(packageString, options = {}) {
  const packageName = parsePackageString(packageString).name
  const installPath = getInstallPath(packageString)
  return mkdir(config.tmp)
    .then(() => mkdir(installPath))
    .then(() => {
      fs.writeFileSync(
        path.join(installPath, "package.json"),
        JSON.stringify({ dependencies: {} })
      )

      return installPackage(packageString, installPath, {
        client: options.client,
        limitConcurrency: options.limitConcurrency,
        networkConcurrency: options.networkConcurrency
      })
    })
    .then(() => {
      const externals = getExternals(packageName, installPath)
      debug('externals %o', externals)
      return Promise.all([
        getPackageJSONDetails(packageName, installPath),
        buildPackage(packageName, installPath, externals, options)
      ])
    })
    .then(([pacakgeJSONDetails, builtDetails]) => {
      rimraf(installPath, () => {})
      return Object.assign({}, pacakgeJSONDetails, builtDetails)
    })
}

module.exports = getPackageStats