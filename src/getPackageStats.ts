/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

import { promises as fs } from 'fs'
import path from 'path'
import { getExternals, parsePackageString } from './utils/common.utils'
import InstallationUtils from './utils/installation.utils'
import BuildUtils from './utils/build.utils'
import { UnexpectedBuildError } from './errors/CustomError'
import { GetPackageStatsOptions } from './common.types'
import Telemetry from './utils/telemetry.utils'
import { performance } from 'perf_hooks'

function getPackageJSONDetails(packageName: string, installPath: string) {
  const startTime = performance.now()
  const packageJSONPath = path.join(
    installPath,
    'node_modules',
    packageName,
    'package.json'
  )
  return fs.readFile(packageJSONPath, 'utf8').then(
    (contents: string) => {
      const parsedJSON = JSON.parse(contents)
      Telemetry.getPackageJSONDetails(packageName, true, startTime)

      return {
        dependencyCount:
          'dependencies' in parsedJSON
            ? Object.keys(parsedJSON.dependencies).length
            : 0,
        hasJSNext: parsedJSON['jsnext:main'] || false,
        hasJSModule: parsedJSON['module'] || false,
        isModuleType: parsedJSON['type'] === 'module',
        hasSideEffects:
          'sideEffects' in parsedJSON ? parsedJSON['sideEffects'] : true,
        peerDependencies:
          'peerDependencies' in parsedJSON
            ? Object.keys(parsedJSON.peerDependencies)
            : [],
      }
    },
    err => {
      Telemetry.getPackageJSONDetails(packageName, false, startTime, err)
    }
  )
}

export default async function getPackageStats(
  packageString: string,
  optionsRaw: GetPackageStatsOptions
) {
  const startTime = performance.now()
  const defaultMinifier: 'terser' = 'terser'

  const options = {
    minifier: defaultMinifier,
    ...optionsRaw,
  }

  const { name: packageName, isLocal, normalPath, importPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  if (options.debug) {
    console.log('Install path:', installPath)
  }
  try {
    await InstallationUtils.installPackage(normalPath, installPath, {
      isLocal,
      client: options.client,
      limitConcurrency: options.limitConcurrency,
      networkConcurrency: options.networkConcurrency,
      installTimeout: options.installTimeout,
    })

    const externals = getExternals(packageName, installPath)
    const [packageJSONDetails, builtDetails] = await Promise.all([
      getPackageJSONDetails(packageName, installPath),
      BuildUtils.buildPackageIgnoringMissingDeps({
        name: packageName,
        importPath,
        installPath,
        externals,
        options: {
          debug: options.debug,
          customImports: options.customImports,
          minifier: options.minifier,
          includeDependencySizes: true,
        },
      }),
    ])

    const mainAssets = builtDetails.assets.filter(asset => asset.name === 'main')

    if (!mainAssets.length) {
      throw new UnexpectedBuildError(
        'Did not find a main asset in the built bundle'
      )
    }

    const mainSizes = mainAssets.reduce((acc, asset) => {
      acc.size += asset.size
      acc.gzip += asset.gzip
      if (asset.parse) {
        acc.parse = acc.parse || {baseParseTime: 0, scriptParseTime: 0}
        acc.parse.baseParseTime += asset.parse.baseParseTime || 0
        acc.parse.scriptParseTime += asset.parse.scriptParseTime || 0
      }
      return acc
    }, { size: 0, gzip: 0, parse: null as null | { baseParseTime: number, scriptParseTime: number } })

    Telemetry.packageStats(
      packageString,
      true,
      performance.now() - startTime,
      options
    )
    return {
      ...packageJSONDetails,
      ...builtDetails,
      size: mainSizes.size,
      gzip: mainSizes.gzip,
      parse: mainSizes.parse,
    }
  } catch (e) {
    Telemetry.packageStats(
      packageString,
      false,
      performance.now() - startTime,
      options
    )
    throw e
  } finally {
    if (!options.debug) {
      await InstallationUtils.cleanupPath(installPath)
    }
  }
}
