const debug = require('debug')('bp:worker')

const { getExternals, parsePackageString } = require('./utils/common.utils')
const { getAllExports } = require('./utils/exports.utils')
const InstallationUtils = require('./utils/installation.utils')
const BuildUtils = require('./utils/build.utils')

async function installPackage(packageString, installPath, options) {
  const { isLocal } = parsePackageString(packageString)

  await InstallationUtils.installPackage(packageString, installPath, {
    isLocal,
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency,
  })
}

async function getAllPackageExports(packageString, options = {}) {
  const { name: packageName, isLocal, normalPath } = parsePackageString(
    packageString
  )
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)
    return await getAllExports(isLocal ? normalPath : installPath, packageName)
  } finally {
    await InstallationUtils.cleaupPath(installPath)
  }
}

async function getPackageExportSizes(packageString, options = {}) {
  const { name: packageName, isLocal, normalPath } = parsePackageString(
    packageString
  )
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await installPackage(packageString, installPath, options)

    const exportMap = await getAllExports(
      isLocal ? normalPath : installPath,
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

module.exports = { getPackageExportSizes, getAllPackageExports }
