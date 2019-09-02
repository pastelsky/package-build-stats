const debug = require('debug')('bp:worker')

const { getExternals, parsePackageString } = require('./utils/common.utils')
const { getAllExports } = require('./utils/exports.utils')
const InstallationUtils = require('./utils/installation.utils')
const BuildUtils = require('./utils/build.utils')


async function installPackage(packageString, options) {
  const packageName = parsePackageString(packageString).name
  const installPath = await InstallationUtils.preparePath(packageString)

  await InstallationUtils.installPackage(packageString, installPath, {
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency,
  })

  return  { installPath, packageName }
}

async function getAllPackageExports(packageString, options = {}) {
  const { packageName, installPath } = await installPackage(packageString, options)
  return await getAllExports(installPath, packageName)
}

async function getPackageExportSizes(packageString, options = {}) {
  const { packageName, installPath } = await installPackage(packageString, options)

  const exportMap = await getAllExports(installPath, packageName)
  const exports = Object.keys(exportMap).filter(exp => !(exp === 'default'))
  debug('Got %d exports for %s', exports.length, packageString)

  const externals = getExternals(packageName, installPath)
  try {
    const builtDetails = await BuildUtils.buildPackageIgnoringMissingDeps({
      name: packageName,
      installPath,
      externals,
      options: {
        customImports: exports,
        splitCustomImports: true,
      },
    })

    InstallationUtils.cleaupPath(installPath)
    return {
      ...builtDetails,
      assets: builtDetails.assets.map(asset => ({
        ...asset,
        path: exportMap[asset.name],
      })),
    }
  } catch (err) {
    await InstallationUtils.cleaupPath(installPath)
    throw err
  }
}

module.exports = { getPackageExportSizes, getAllPackageExports }
