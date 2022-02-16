'use strict'
/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */
var __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod }
}
Object.defineProperty(exports, '__esModule', { value: true })
const fs_1 = require('fs')
const path_1 = __importDefault(require('path'))
const common_utils_1 = require('./utils/common.utils')
const installation_utils_1 = __importDefault(require('./utils/installation.utils'))
const build_utils_1 = __importDefault(require('./utils/build.utils'))
const telemetry_utils_1 = __importDefault(require('./utils/telemetry.utils'))
const perf_hooks_1 = require('perf_hooks')

function getPackageJSONDetails(packageName, installPath) {
  const startTime = perf_hooks_1.performance.now()
  const packageJSONPath = path_1.default.join(installPath, 'node_modules', packageName, 'package.json')
  return fs_1.promises.readFile(packageJSONPath, 'utf8').then((contents) => {
    const parsedJSON = JSON.parse(contents)
    telemetry_utils_1.default.getPackageJSONDetails(packageName, true, startTime)
    return {
      dependencyCount: 'dependencies' in parsedJSON
        ? Object.keys(parsedJSON.dependencies).length
        : 0,
      mainFields: [
        parsedJSON['module'] && 'module',
        parsedJSON['jsnext:main'] && 'jsnext:main',
        parsedJSON['main'] && 'main',
        parsedJSON['style'] && 'style'
      ].filter(Boolean),
      hasJSNext: parsedJSON['jsnext:main'] || false,
      hasJSModule: parsedJSON['module'] || false,
      isModuleType: parsedJSON['type'] === 'module',
      hasSideEffects: 'sideEffects' in parsedJSON ? parsedJSON['sideEffects'] : true,
      peerDependencies: 'peerDependencies' in parsedJSON
        ? Object.keys(parsedJSON.peerDependencies)
        : []
    }
  }, err => {
    telemetry_utils_1.default.getPackageJSONDetails(packageName, false, startTime, err)
  })
}

async function getPackageStats(packageString, optionsRaw) {
  const startTime = perf_hooks_1.performance.now()
  const defaultMinifier = 'terser'
  const options = Object.assign({ minifier: defaultMinifier }, optionsRaw)
  const { name: packageName, isLocal } = (0, common_utils_1.parsePackageString)(packageString)
  const installPath = await installation_utils_1.default.preparePath(packageName)
  if (options.debug) {
    console.log('Install path:', installPath)
  }
  try {
    await installation_utils_1.default.installPackage(packageString, installPath, {
      isLocal,
      client: options.client,
      limitConcurrency: options.limitConcurrency,
      networkConcurrency: options.networkConcurrency,
      installTimeout: options.installTimeout
    })
    const externals = (0, common_utils_1.getExternals)(packageName, installPath)
    const [pacakgeJSONDetails, builtDetails] = await Promise.all([
      getPackageJSONDetails(packageName, installPath),
      build_utils_1.default.buildPackageIgnoringMissingDeps({
        name: packageName,
        installPath,
        externals,
        options: {
          debug: options.debug,
          customImports: options.customImports,
          minifier: options.minifier,
          includeDependencySizes: true
        }
      })
    ])
    const isStylePackageOnly = pacakgeJSONDetails.mainFields.length === 1 &&
      pacakgeJSONDetails.mainFields[0] === 'style'
    if (isStylePackageOnly) {
      builtDetails.assets = builtDetails.assets.filter(asset => asset.type !== 'js')
    }
    const hasCSSAsset = builtDetails.assets.some(asset => asset.type === 'css')
    const mainAsset = builtDetails.assets.find(asset => asset.name.startsWith('main') &&
      asset.type === (hasCSSAsset ? 'css' : 'js'))
    console.log('builtDetails.assets is ', builtDetails.assets)
    telemetry_utils_1.default.packageStats(packageString, true, perf_hooks_1.performance.now() - startTime, options)
    return Object.assign(Object.assign(Object.assign({}, pacakgeJSONDetails), builtDetails), {
      buildVersion: require('../package.json').version,
      size: mainAsset.size,
      gzip: mainAsset.gzip,
      parse: mainAsset.parse
    })
  } catch (e) {
    telemetry_utils_1.default.packageStats(packageString, false, perf_hooks_1.performance.now() - startTime, options)
    throw e
  } finally {
    if (!options.debug) {
      // await InstallationUtils.cleanupPath(installPath)
    }
  }
}

exports.default = getPackageStats
