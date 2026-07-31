/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  getExternals,
  parsePackageString,
  throwIfAborted,
} from './utils/common.utils.js'
import InstallationUtils from './utils/installation.utils.js'
import BuildUtils from './utils/build.utils.js'
import { UnexpectedBuildError } from './errors/CustomError.js'
import type { GetPackageStatsOptions } from './common.types.js'
import Telemetry from './utils/telemetry.utils.js'

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
    error => {
      Telemetry.getPackageJSONDetails(packageName, false, startTime, error)
      throw error
    },
  )
}

export default async function getPackageStats(
  packageString: string,
  options: GetPackageStatsOptions = {},
) {
  const startTime = performance.now()
  const timings: Record<string, number> = {}

  const { name: packageName, isLocal } = parsePackageString(packageString)

  const preparePathStart = performance.now()
  const installPath = await InstallationUtils.preparePath(
    packageName,
    options.client,
    options.signal,
  )
  timings.preparePath = performance.now() - preparePathStart
  console.log(`[PERF] preparePath: ${timings.preparePath.toFixed(2)}ms`)

  try {
    throwIfAborted(options.signal)
    const installStart = performance.now()
    await InstallationUtils.installPackage(packageString, installPath, {
      isLocal,
      client: options.client,
      limitConcurrency: options.limitConcurrency,
      networkConcurrency: options.networkConcurrency,
      installTimeout: options.installTimeout,
      signal: options.signal,
    })
    throwIfAborted(options.signal)
    timings.install = performance.now() - installStart
    console.log(`[PERF] installPackage: ${timings.install.toFixed(2)}ms`)

    const externalsStart = performance.now()
    const externals = getExternals(packageName, installPath)
    throwIfAborted(options.signal)
    timings.getExternals = performance.now() - externalsStart
    console.log(`[PERF] getExternals: ${timings.getExternals.toFixed(2)}ms`)

    const parallelStart = performance.now()
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
          signal: options.signal,
        },
      }),
    ])
    throwIfAborted(options.signal)
    timings.parallelBuild = performance.now() - parallelStart
    console.log(
      `[PERF] parallel (packageJSON + build): ${timings.parallelBuild.toFixed(2)}ms`,
    )

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
    }
  } catch (e) {
    Telemetry.packageStats(
      packageString,
      false,
      performance.now() - startTime,
      options,
      e,
    )
    throw e
  } finally {
    if (!options.debug) {
      await InstallationUtils.cleanupPath(installPath)
    }
  }
}
