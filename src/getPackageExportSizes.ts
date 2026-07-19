import Telemetry from './utils/telemetry.utils.js'
import { performance } from 'perf_hooks'
import path from 'path'

import createDebug from 'debug'

const debug = createDebug('bp:worker')

import { getExternals, parsePackageString } from './utils/common.utils.js'
import { getAllExports } from './utils/exports.utils.js'
import InstallationUtils from './utils/installation.utils.js'
import BuildUtils from './utils/build.utils.js'
import {
  GetPackageStatsOptions,
  InstallPackageOptions,
} from './common.types.js'
import { UnsupportedPackageError } from './errors/CustomError.js'

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
  })
}

export async function getAllPackageExports(
  packageString: string,
  options: InstallPackageOptions = {},
) {
  const startTime = performance.now()
  const { name: packageName, normalPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)
    // The package is installed in node_modules subdirectory
    const packagePath =
      normalPath || path.join(installPath, 'node_modules', packageName)
    const results = await getAllExports(
      packageString,
      packagePath,
      packageName,
      installPath, // Pass installPath as base for relative path calculation
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
  const installPath = await InstallationUtils.preparePath(packageName)
  timings.preparePath = performance.now() - preparePathStart
  console.log(
    `[PERF] [ExportSizes] preparePath: ${timings.preparePath.toFixed(2)}ms`,
  )

  try {
    const installStart = performance.now()
    await installPackage(packageString, installPath, options)
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
    )
    timings.getAllExports = performance.now() - getAllExportsStart
    console.log(
      `[PERF] [ExportSizes] getAllExports: ${timings.getAllExports.toFixed(2)}ms`,
    )

    const exports = Object.keys(exportMap).filter(exp => !(exp === 'default'))
    debug('Got %d exports for %s', exports.length, packageString)
    console.log(`[PERF] [ExportSizes] Found ${exports.length} exports`)

    if (exports.length > 1000) {
      throw new UnsupportedPackageError(
        new Error(`Package has too many exports (${exports.length})`),
        {
          reason: `Package has too many exports (${exports.length}). Export analysis is only supported for packages with up to 1,000 exports.`,
        },
      )
    }

    const externalsStart = performance.now()
    const externals = getExternals(packageName, installPath)
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

    for (let i = 0; i < exports.length; i += chunkSize) {
      const chunk = exports.slice(i, i + chunkSize)
      const chunkDetails = await BuildUtils.buildPackageIgnoringMissingDeps({
        name: packageName,
        installPath,
        externals,
        options: {
          customImports: chunk,
          splitCustomImports: true,
          includeDependencySizes: false,
        },
      })
      assets.push(...chunkDetails.assets)
      if (chunkDetails.ignoredMissingDependencies) {
        chunkDetails.ignoredMissingDependencies.forEach(dep => {
          ignoredMissingDependenciesSet.add(dep)
        })
      }
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
