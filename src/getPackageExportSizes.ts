const debug = require('debug')('bp:worker')

import { getExternals, parsePackageString } from './utils/common.utils'
import { getAllExports } from './utils/exports.utils'
import InstallationUtils from './utils/installation.utils'
import BuildUtils from './utils/build.utils'
import { InstallPackageOptions } from './common.types'

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
  const { name: packageName, normalPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)
    return await getAllExports(normalPath || installPath, packageName)
  } finally {
    await InstallationUtils.cleaupPath(installPath)
  }
}

export async function getPackageExportSizes(packageString: string, options = {}) {
  const { name: packageName, normalPath } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)

    const exportMap = await getAllExports(
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
      },
    })

    return {
      ...builtDetails,
      assets: builtDetails.assets.map(asset => ({
        ...asset,
        path: exportMap[asset.name],
      })),
    }
  } finally {
    await InstallationUtils.cleaupPath(installPath)
  }
}
