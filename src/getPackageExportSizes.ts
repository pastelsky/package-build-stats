import Telemetry from './utils/telemetry.utils.js'
import { performance } from 'node:perf_hooks'
import path from 'node:path'

import createDebug from 'debug'

const debug = createDebug('bp:worker')

import {
  getExternals,
  parsePackageString,
  throwIfAborted,
} from './utils/common.utils.js'
import { getAllExports } from './utils/exports.utils.js'
import InstallationUtils from './utils/installation.utils.js'
import BuildUtils from './utils/build.utils.js'
import type {
  GetPackageStatsOptions,
  InstallPackageOptions,
} from './common.types.js'

async function installPackage(
  packageString: string,
  installPath: string,
  options: InstallPackageOptions,
) {
  const { isLocal } = parsePackageString(packageString)

  await InstallationUtils.installPackage(packageString, installPath, {
    isLocal,
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency,
    installTimeout: options.installTimeout,
    signal: options.signal,
  })
}

export async function getAllPackageExports(
  packageString: string,
  options: InstallPackageOptions = {},
) {
  const startTime = performance.now()
  const { name: packageName, normalPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(
    packageName,
    options.client,
    options.signal,
  )

  try {
    throwIfAborted(options.signal)
    await installPackage(packageString, installPath, options)
    throwIfAborted(options.signal)
    // The package is installed in node_modules subdirectory
    const packagePath =
      normalPath || path.join(installPath, 'node_modules', packageName)
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
    await InstallationUtils.cleanupPath(installPath)
  }
}

export async function getPackageExportSizes(
  packageString: string,
  options: GetPackageStatsOptions = {},
) {
  const startTime = performance.now()
  const timings: Record<string, number> = {}

  const { name: packageName, normalPath } = parsePackageString(packageString)

  const preparePathStart = performance.now()
  const installPath = await InstallationUtils.preparePath(
    packageName,
    options.client,
    options.signal,
  )
  timings.preparePath = performance.now() - preparePathStart
  console.log(
    `[PERF] [ExportSizes] preparePath: ${timings.preparePath.toFixed(2)}ms`,
  )

  try {
    throwIfAborted(options.signal)
    const installStart = performance.now()
    await installPackage(packageString, installPath, options)
    throwIfAborted(options.signal)
    timings.install = performance.now() - installStart
    console.log(
      `[PERF] [ExportSizes] installPackage: ${timings.install.toFixed(2)}ms`,
    )

    // The package is installed in node_modules subdirectory
    const packagePath =
      normalPath || path.join(installPath, 'node_modules', packageName)

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
        installPath,
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
    await InstallationUtils.cleanupPath(installPath)
  }
}
