import Telemetry from './utils/telemetry.utils'
import { performance } from 'perf_hooks'
import pLimit from 'p-limit'
import _ from 'lodash'

const CONCURRENCY = 60
const limit = pLimit(CONCURRENCY)
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
    installTimeout: options.installTimeout,
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
    await InstallationUtils.cleanupPath(installPath)
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

    const exportsChunks = _.chunk(exports, 60)

    const promises = exportsChunks.map(exportChunk =>
      limit(() =>
        BuildUtils.buildPackageIgnoringMissingDeps({
          name: packageName,
          installPath,
          externals,
          options: {
            customImports: exportChunk,
            splitCustomImports: true,
            includeDependencySizes: false,
            minifier: options.minifier || 'terser',
            debug: options.debug,
          },
        })
      )
    )

    const results = await Promise.all(promises)
    const allAssets = results.flatMap(result => result.assets)

    Telemetry.packageExportsSizes(packageString, startTime, true, options)
    return {
      buildVersion: require('../package.json').version,
      assets: allAssets.map(asset => ({
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
