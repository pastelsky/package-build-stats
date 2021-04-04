import Telemetry from './utils/telemetry.utils'
import { performance } from 'perf_hooks'

const debug = require('debug')('bp:worker')

import { getExternals, parsePackageString } from './utils/common.utils'
import { getAllExports } from './utils/exports.utils'
import InstallationUtils from './utils/installation.utils'
import BuildUtils from './utils/build.utils'
import { GetPackageStatsOptions, InstallPackageOptions } from './common.types'

async function installPackage(
  packageString: string,
  installPath: string,
  options: InstallPackageOptions
) {
  const { isLocal } = parsePackageString(packageString)

  await InstallationUtils.installPackage(packageString, installPath, {
    isLocal,
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency,
  })
}

export async function getAllPackageExports(
  packageString: string,
  options: InstallPackageOptions = {}
) {
  const startTime = performance.now()
  const { name: packageName, normalPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)
    const results = await getAllExports(
      packageString,
      normalPath || installPath,
      packageName
    )
    Telemetry.packageExports(packageString, startTime, true)
    return results
  } catch (err) {
    Telemetry.packageExports(packageString, startTime, false, err)
    throw err
  } finally {
    await InstallationUtils.cleaupPath(installPath)
  }
}

export async function getPackageExportSizes(
  packageString: string,
  options: GetPackageStatsOptions = {
    minifier: 'terser',
  }
) {
  const startTime = performance.now()
  const { name: packageName, normalPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)

    const exportMap = await getAllExports(
      packageString,
      normalPath || installPath,
      packageName
    )

    const exports = Object.keys(exportMap).filter(exp => !(exp === 'default'))
    debug('Got %d exports for %s', exports.length, packageString)

    const externals = getExternals(packageName, installPath)

    const builtDetails = await BuildUtils.buildPackageIgnoringMissingDeps({
      name: packageName,
      installPath,
      externals,
      options: {
        customImports: exports,
        splitCustomImports: true,
        includeDependencySizes: false,
        minifier: options.minifier || 'terser',
      },
    })

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
    await InstallationUtils.cleaupPath(installPath)
  }
}
