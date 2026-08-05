import Telemetry from './utils/telemetry.utils.js'
import { performance } from 'node:perf_hooks'

import createDebug from 'debug'

const debug = createDebug('bp:worker')

import { getExternals, throwIfAborted } from './utils/common.utils.js'
import { getAllExports } from './utils/exports.utils.js'
import BuildUtils from './utils/build.utils.js'
import type {
  GetPackageStatsOptions,
  InstallPackageOptions,
} from './common.types.js'
import { preparePackage, type PreparedPackage } from './packageInstallation.js'

export async function getAllPackageExports(
  packageString: string,
  options: InstallPackageOptions = {},
) {
  const startTime = performance.now()
  let preparedPackage: PreparedPackage | undefined

  try {
    preparedPackage = await preparePackage(packageString, options, false)
    const { packageName, packagePath, installPath } = preparedPackage
    throwIfAborted(options.signal)
    const results = await getAllExports(
      packageString,
      packagePath,
      packageName,
      installPath, // Pass installPath as base for relative path calculation
      options.signal,
    )
    Telemetry.packageExports(packageString, startTime, true)
    return results
  } catch (err) {
    Telemetry.packageExports(packageString, startTime, false, err)
    throw err
  } finally {
    await preparedPackage?.cleanup()
  }
}

export async function getPackageExportSizes(
  packageString: string,
  options: GetPackageStatsOptions = {},
) {
  const startTime = performance.now()
  const timings: Record<string, number> = {}
  let preparedPackage: PreparedPackage | undefined

  try {
    const installStart = performance.now()
    preparedPackage = await preparePackage(packageString, options)
    const { packageName, packagePath, installPath, buildPath } = preparedPackage
    throwIfAborted(options.signal)
    timings.install = performance.now() - installStart
    console.log(
      `[PERF] [ExportSizes] installPackage: ${timings.install.toFixed(2)}ms`,
    )
    const getAllExportsStart = performance.now()
    const exportMap = await getAllExports(
      packageString,
      packagePath,
      packageName,
      installPath, // Pass installPath as base for relative path calculation
      options.signal,
    )
    throwIfAborted(options.signal)
    timings.getAllExports = performance.now() - getAllExportsStart
    console.log(
      `[PERF] [ExportSizes] getAllExports: ${timings.getAllExports.toFixed(2)}ms`,
    )

    const exports = Object.keys(exportMap).filter(exp => !(exp === 'default'))
    debug('Got %d exports for %s', exports.length, packageString)
    console.log(`[PERF] [ExportSizes] Found ${exports.length} exports`)

    const buildExports = exports.slice(0, 1000)
    const extraExports = exports.slice(1000)

    const externalsStart = performance.now()
    const externals = getExternals(packageName, installPath)
    throwIfAborted(options.signal)
    timings.getExternals = performance.now() - externalsStart
    console.log(
      `[PERF] [ExportSizes] getExternals: ${timings.getExternals.toFixed(2)}ms`,
    )

    const buildStart = performance.now()
    const chunkSize = 100
    const assets: Array<{
      name: string
      type: string
      size: number
      gzip: number
    }> = []
    const ignoredMissingDependenciesSet = new Set<string>()

    for (let i = 0; i < buildExports.length; i += chunkSize) {
      throwIfAborted(options.signal)
      const chunk = buildExports.slice(i, i + chunkSize)
      // Build chunks sequentially to cap Rspack's peak memory usage.
      // oxlint-disable-next-line no-await-in-loop
      const chunkDetails = await BuildUtils.buildPackageIgnoringMissingDeps({
        name: packageName,
        installPath: buildPath,
        dependencyPath: installPath,
        externals,
        options: {
          customImports: chunk,
          splitCustomImports: true,
          includeDependencySizes: false,
          signal: options.signal,
        },
      })
      throwIfAborted(options.signal)
      assets.push(...chunkDetails.assets)
      if (chunkDetails.ignoredMissingDependencies) {
        chunkDetails.ignoredMissingDependencies.forEach(dep => {
          ignoredMissingDependenciesSet.add(dep)
        })
      }
    }

    if (extraExports.length > 0) {
      const extraAssets = extraExports.map(name => ({
        name,
        type: 'js',
        size: 0,
        gzip: 0,
      }))
      assets.push(...extraAssets)
    }

    timings.build = performance.now() - buildStart
    console.log(
      `[PERF] [ExportSizes] buildPackage: ${timings.build.toFixed(2)}ms`,
    )

    Telemetry.packageExportsSizes(packageString, startTime, true, options)

    const builtDetails = {
      assets,
      ignoredMissingDependencies:
        ignoredMissingDependenciesSet.size > 0
          ? Array.from(ignoredMissingDependenciesSet)
          : undefined,
    }

    return {
      ...builtDetails,
      assets: builtDetails.assets.map(asset => ({
        ...asset,
        path: exportMap[asset.name],
      })),
    }
  } catch (err) {
    Telemetry.packageExportsSizes(packageString, startTime, false, options, err)
    throw err
  } finally {
    await preparedPackage?.cleanup()
  }
}
