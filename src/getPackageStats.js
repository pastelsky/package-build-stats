/**
 * Code heavily inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

const fs = require("fs")
const path = require("path")
const { gzipSync } = require("zlib")
const debug = require("debug")("bp:worker")
const pify = require('pify')

const webpack = require("webpack")
const MemoryFS = require("memory-fs")
const rimraf = require('rimraf')

const { exec, getExternals, parsePackageString } = require("../utils/server.utils")
const getDependencySizes = require('./getDependencySizeTree')
const getParseTime = require('./getParseTime')
const mkdir = require('mkdir-promise')
const config = require('./config')
const CustomError = require("./CustomError")
const sanitize = require("sanitize-filename")
const makeWebpackConfig = require('./webpack.config')

function getInstallPath(packageName) {
  return path.join(config.tmp, 'packages', sanitize(`build-${packageName}`))
}

function createEntryPoint(name, installPath, customImports) {
  const entryPath = path.join(installPath, 'index.js')

  let importStatement;

  if (customImports) {
    importStatement = `
    import { ${customImports.join(', ')} } from '${name}'; 
    console.log(${customImports.join(', ')})
     `
  } else {
    importStatement = `const p = require('${name}'); console.log(p)`
  }

  try {
    fs.writeFileSync(
      entryPath,
      importStatement,
      "utf-8"
    )
    return entryPath
  } catch (err) {
    throw new CustomError("EntryPointError", err)
  }
}

async function installPackage(
  packageName,
  installPath,
  { client, limitConcurrency, networkConcurrency, additionalPackages = [] }
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
    command = `yarn add ${packageName} ${additionalPackages.join} --${flags.join(" --")}`
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

  try {
    await exec(command, {
      cwd: installPath
    })
    debug("install finish %s", packageName)
  } catch (err) {
    if (err.includes('code E404')) {
      throw new CustomError("PackageNotFoundError", err)
    } else {
      throw new CustomError("InstallError", err)
    }
  }
}

function compilePackage({ entryPoint, externals }) {
  const compiler = webpack(makeWebpackConfig({ entryPoint, externals }))
  const memoryFileSystem = new MemoryFS()
  compiler.outputFileSystem = memoryFileSystem

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      // stats object can be empty if there are build errors
      resolve({ stats, err, memoryFileSystem })
    })
  })
}

async function buildPackage({ name, installPath, externals, options }) {
  const entryPoint = createEntryPoint(name, installPath, options.customImports)
  debug("build start %s", name)
  const { stats, err, memoryFileSystem } = await compilePackage({ entryPoint, externals })
  debug("build end %s", name)

  let jsonStats = stats ? stats.toJson({
    assets: true,
    children: false,
    chunks: false,
    chunkGroups: false,
    chunkModules: false,
    chunkOrigins: false,
    modules: true,
    errorDetails: false,
    entrypoints: false,
    reasons: false,
    maxModules: 500,
    performance: false,
    source: true,
    depth: true,
    providedExports: true,
    warnings: false,
    modulesSort: "depth",
  }) : {}

  fs.writeFileSync('/Users/skanodia/dev/package-build-stats/json.json', JSON.stringify(jsonStats, null, 2), 'utf8')

  if ((err && err.details) && !stats) {
    throw new CustomError("BuildError", err.details, {
      name: err.name,
      message: err.error
    })
  } else if (stats.compilation.errors && stats.compilation.errors.length) {
    const missingModuleErrors = stats.compilation.errors
      .filter(error => error.name === 'ModuleNotFoundError')
    console.log('got missing module error!', missingModuleErrors.length)

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
        throw new CustomError(
          "EntryPointError",
          stats.compilation.errors.map(err => err.toString())
        )
      } else {
        throw new CustomError(
          "MissingDependencyError",
          stats.compilation.errors.map(err => err.toString()),
          { missingModules: Array.from(new Set(missingModules)) }
        )
      }
    } else if (jsonStats.errors && (jsonStats.errors.length > 0)) {
      console.log('errors', jsonStats.errors)
      throw new CustomError("BuildError", jsonStats.errors)
    }
  } else {
    const isCSSAsset = jsonStats.assets.some(
      asset => asset.name.endsWith('.css'))
    const bundleName = isCSSAsset ? 'main.bundle.css' : 'main.bundle.js'
    const size = jsonStats.assets
      .filter(x => x.name === bundleName)
      .pop()
      .size

    const bundle = path.join(process.cwd(), 'dist', bundleName)
    const bundleContents = memoryFileSystem.readFileSync(bundle)
    let parseTimes = {}
    if (options.calcParse) {
      parseTimes = getParseTime(bundleContents)
    }
    const gzip = gzipSync(bundleContents, {}).length

    debug("build result %O", { size, gzip })
    return {
      size,
      gzip,
      parse: parseTimes,
      ...(!options.customImports && getDependencySizes(jsonStats)),
    }
  }
}

async function buildPackageWithRetries({ name, externals, installPath, options }) {
  try {
    return buildPackage({ name, externals, installPath, options });
  } catch (e) {
    if (e.name === 'MissingDependencyError') {
      const { missingModules } = e.extra
      const newExternals = externals.concat(missingModules)
      debug('%s has missing dependencies, rebuilding without %o', name, missingModules)
      return {
        ignoredMissingDependencies: missingModules,
        ...(await buildPackage({ name, externals: newExternals, installPath, options }))
      };
    } else {
      throw e;
    }
  }
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

async function getPackageStats(packageString, options = {}) {
  const packageName = parsePackageString(packageString).name
  const installPath = getInstallPath(packageString)

  await mkdir(config.tmp)
  await mkdir(installPath)

  fs.writeFileSync(
    path.join(installPath, "package.json"),
    JSON.stringify({ dependencies: {} })
  )

  await installPackage(packageString, installPath, {
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency
  })

  const externals = getExternals(packageName, installPath)
  const noop = () => {
  }

  try {
    const [pacakgeJSONDetails, builtDetails] = await Promise.all([
      getPackageJSONDetails(packageName, installPath),
      buildPackageWithRetries({
        name: packageName,
        installPath,
        externals,
        options: {
          customImports: options.customImports,
        },
      })
    ])
    rimraf(installPath, noop)
    return { ...pacakgeJSONDetails, ...builtDetails }
  } catch (err) {
    rimraf(installPath, noop)
    throw err
  }
}

module.exports = getPackageStats