/**
 * Parts of the code are inspired from the `import-cost` project
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
const isValidNPMName = require('is-valid-npm-name')

const { exec, getExternals, parsePackageString } = require("../utils/server.utils")
const getDependencySizes = require('./getDependencySizeTree')
const getParseTime = require('./getParseTime')
const mkdir = require('mkdir-promise')
const config = require('./config')
const CustomError = require("./CustomError")
const sanitize = require("sanitize-filename")
const shortId = require('shortid')
const makeWebpackConfig = require('./webpack.config')

function getInstallPath(packageName) {
  const id = shortId.generate().slice(0, 3)
  return path.join(config.tmp, 'packages', sanitize(`build-${packageName}-${id}`))
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
    command = `yarn add ${packageName} ${additionalPackages.join(' ')} --${flags.join(" --")}`
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
      "production",
      //"fetch-retry-factor 0",
      //"fetch-retries 0",
      "json"
    ]

    command = `npm install ${packageName} ${additionalPackages.join(' ')} --${flags.join(" --")}`
  }

  debug("install start %s", packageName)

  try {
    await exec(command, {
      cwd: installPath,
      maxBuffer: 1024 * 500
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
  const installedNPMPath = path.join(installPath, 'node_modules', parsePackageString(name).name)
  let topLevelExports = []
  // try {
  //   topLevelExports = Object.keys(require(installedNPMPath))
  // } catch (e) {
  // }

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

  if ((err && err.details) && !stats) {
    throw new CustomError("BuildError", err.details, {
      name: err.name,
      message: err.error
    })
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

      let uniqueMissingModules = Array.from(new Set(missingModules))
      uniqueMissingModules = uniqueMissingModules
        .filter(mod => !mod.startsWith(`${uniqueMissingModules[0]}/`))

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
          { missingModules: uniqueMissingModules }
        )
      }
    } else if (jsonStats.errors && (jsonStats.errors.length > 0)) {
      if (jsonStats.errors.some(error => error.includes('Unexpected character \'#\''))) {
        throw new CustomError("CLIBuildError", jsonStats.errors)
      } else {
        throw new CustomError("BuildError", jsonStats.errors)
      }
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
      sizes: getSizes(size),
      gzip,
      gzips: getSizes(gzip),
      downloadTimes: getTimeFromSize(gzip),
      parse: parseTimes,
      topLevelExports,
      ...(!options.customImports && { dependencySizes: getDependencySizes(jsonStats) }),
    }
  }
}

/**
 * Convert/format raw size to an object with B, kB, and mB properties for easier client use
 * @param {Number} value - the original size in bytes
 * @return {Object} sizes of form: {B: Number, kB: Number, mB: Number}
 */
function getSizes (value) {
  const sizes = {
    B: value,
    kB: value / 1024,
  }
  sizes.mB = sizes.kB / 1024

  return sizes
}

/**
 *
 * @param {Number} value in seconds
 * @return {Object} of form: {ms: Number, s: Number}
 */
const getTimes = (value) => {
  return {
    m: Math.round(value * 1000),
    s: value
  }
}

// Picked up from http://www.webpagetest.org/
// Speed in KB/s
const DownloadSpeed = {
  TWO_G: 30,     // 2G Edge
  THREE_G: 50    // Emerging markets 3G
}

/**
 * Convert byte number to different download speeds for a more real world metric about the package
 * @param {Number} sizeInBytes
 * @return {Object} with nested objects 'twoG' and 'threeG' which both have a 'ms' and 's' property
 */
function getTimeFromSize (sizeInBytes) {
  const sizeInKB = sizeInBytes / 1024
  return {
    twoG: getTimes( sizeInKB / DownloadSpeed.TWO_G),
    threeG: getTimes(sizeInKB / DownloadSpeed.THREE_G),
  }
}

async function buildPackageWithRetries({ name, externals, installPath, options }) {
  try {
    return await buildPackage({ name, externals, installPath, options });
  } catch (e) {
    if (
      e.name === 'MissingDependencyError' &&
      e.extra.missingModules.length <= 6 &&
      e.extra.missingModules.every(mod => isValidNPMName(mod) === true)
    ) {
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
    await rimraf(installPath, noop)
    throw err
  }
}

module.exports = getPackageStats
