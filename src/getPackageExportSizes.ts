import Telemetry from './utils/telemetry.utils'
import { performance } from 'perf_hooks'
import path from 'path'

import createDebug from 'debug'

const debug = createDebug('bp:worker')

import { getExternals, parsePackageString } from './utils/common.utils'
import { getAllExports } from './utils/exports.utils'
import InstallationUtils from './utils/installation.utils'
import BuildUtils from './utils/build.utils'
import { GetPackageStatsOptions, InstallPackageOptions } from './common.types'

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
  console.log(`[PERF] [ExportSizes] preparePath: ${timings.preparePath.toFixed(2)}ms`)

  try {
    const installStart = performance.now()
    await installPackage(packageString, installPath, options)
    timings.install = performance.now() - installStart
    console.log(`[PERF] [ExportSizes] installPackage: ${timings.install.toFixed(2)}ms`)

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
    console.log(`[PERF] [ExportSizes] getAllExports: ${timings.getAllExports.toFixed(2)}ms`)

    const exports = Object.keys(exportMap).filter(exp => !(exp === 'default'))
    debug('Got %d exports for %s', exports.length, packageString)
    console.log(`[PERF] [ExportSizes] Found ${exports.length} exports`)

    const externalsStart = performance.now()
    const externals = getExternals(packageName, installPath)
    timings.getExternals = performance.now() - externalsStart
    console.log(`[PERF] [ExportSizes] getExternals: ${timings.getExternals.toFixed(2)}ms`)

    const buildStart = performance.now()
    const builtDetails = await BuildUtils.buildPackageIgnoringMissingDeps({
      name: packageName,
      installPath,
      externals,
      options: {
        customImports: exports,
        splitCustomImports: true,
        includeDependencySizes: false,
      },
    })
    timings.build = performance.now() - buildStart
    console.log(`[PERF] [ExportSizes] buildPackage: ${timings.build.toFixed(2)}ms`)

    Telemetry.packageExportsSizes(packageString, startTime, true, options)
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
