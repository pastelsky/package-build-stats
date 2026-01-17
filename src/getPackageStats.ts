/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

import fs from 'fs/promises'
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
    'package.json',
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
    },
  )
}

export default async function getPackageStats(
  packageString: string,
  options: GetPackageStatsOptions = {},
) {
  const startTime = performance.now()

  const { name: packageName, isLocal } = parsePackageString(packageString)

  const installPath = await InstallationUtils.preparePath(
    packageName,
    options.client,
  )
  try {
    await InstallationUtils.installPackage(packageString, installPath, {
      isLocal,
      client: options.client,
      limitConcurrency: options.limitConcurrency,
      networkConcurrency: options.networkConcurrency,
      installTimeout: options.installTimeout,
    })

    const externals = getExternals(packageName, installPath)

    const [pacakgeJSONDetails, builtDetails] = await Promise.all([
      getPackageJSONDetails(packageName, installPath),
      BuildUtils.buildPackageIgnoringMissingDeps({
        name: packageName,
        installPath,
        externals,
        options: {
          debug: options.debug,
          minify: options.minify !== false,
          customImports: options.customImports,
          includeDependencySizes: true,
        },
      }),
    ])

    const hasCSSAsset = builtDetails.assets.some(asset => asset.type === 'css')
    const mainAsset = builtDetails.assets.find(
      asset =>
        asset.name === 'main' && asset.type === (hasCSSAsset ? 'css' : 'js'),
    )

    if (!mainAsset) {
      throw new UnexpectedBuildError(
        'Did not find a main asset in the built bundle',
      )
    }

    const totalTime = performance.now() - startTime
    Telemetry.packageStats(packageString, true, totalTime, options)

    return {
      ...pacakgeJSONDetails,
      ...builtDetails,
      size: mainAsset.size,
      gzip: mainAsset.gzip,
      installPath,
    }
  } catch (e) {
    Telemetry.packageStats(
      packageString,
      false,
      performance.now() - startTime,
      options,
    )
    throw e
  } finally {
    if (!options.debug) {
      await InstallationUtils.cleanupPath(installPath)
    }
  }
}
