/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

const fs = require('fs')
const path = require('path')
const pify = require('pify')

const { getExternals, parsePackageString } = require('./utils/common.utils')
const InstallationUtils = require('./utils/installation.utils')
const BuildUtils = require('./utils/build.utils')

function getPackageJSONDetails(packageName, installPath) {
  const packageJSONPath = path.join(
    installPath,
    'node_modules',
    packageName,
    'package.json'
  )
  return pify(fs.readFile)(packageJSONPath, 'utf8').then(contents => {
    const parsedJSON = JSON.parse(contents)
    return {
      dependencyCount:
        'dependencies' in parsedJSON
          ? Object.keys(parsedJSON.dependencies).length
          : 0,
      hasJSNext: parsedJSON['jsnext:main'] || false,
      hasJSModule: parsedJSON['module'] || false,
      hasSideEffects:
        'sideEffects' in parsedJSON ? parsedJSON['sideEffects'] : true,
      peerDependencies:
        'peerDependencies' in parsedJSON
          ? Object.keys(parsedJSON.peerDependencies)
          : [],
    }
  })
}

async function getPackageStats(packageString, options = {}) {
  const { name: packageName, isLocal } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  await InstallationUtils.installPackage(packageString, installPath, {
    isLocal,
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency,
  })

  const externals = getExternals(packageName, installPath)
  try {
    const [pacakgeJSONDetails, builtDetails] = await Promise.all([
      getPackageJSONDetails(packageName, installPath),
      BuildUtils.buildPackageIgnoringMissingDeps({
        name: packageName,
        installPath,
        externals,
        options: {
          customImports: options.customImports,
        },
      }),
    ])

    const hasCSSAsset = builtDetails.assets.some(asset => asset.type === 'css')
    const mainAsset = builtDetails.assets.find(
      asset =>
        asset.name === 'main' && asset.type === (hasCSSAsset ? 'css' : 'js')
    )

    // InstallationUtils.cleaupPath(installPath)
    return {
      ...pacakgeJSONDetails,
      ...builtDetails,
      size: mainAsset.size,
      gzip: mainAsset.gzip,
      parse: mainAsset.parse,
    }
  } catch (err) {
    await InstallationUtils.cleaupPath(installPath)
    throw err
  }
}

module.exports = getPackageStats
