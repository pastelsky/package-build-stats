/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

import { promises as fs } from 'fs'
import path from 'path'
import { getExternals, parsePackageString } from './utils/common.utils'
import InstallationUtils from './utils/installation.utils'
import BuildUtils from './utils/build.utils'
import { UnexpectedBuildError } from './errors/CustomError'
import { GetPackageStatsOptions } from './common.types'

function getPackageJSONDetails(packageName: string, installPath: string) {
  const packageJSONPath = path.join(
    installPath,
    'node_modules',
    packageName,
    'package.json'
  )
  return fs.readFile(packageJSONPath, 'utf8').then((contents: string) => {
    const parsedJSON = JSON.parse(contents)
    return {
      dependencyCount:
        'dependencies' in parsedJSON
          ? Object.keys(parsedJSON.dependencies).length
          : 0,
      hasJSNext: parsedJSON['jsnext:main'] || false,
      hasJSModule: parsedJSON['module'] || false,
      isModuleType: parsedJSON['type'] === 'module',
      hasSideEffects:
        'sideEffects' in parsedJSON ? parsedJSON['sideEffects'] : true,
      peerDependencies:
        'peerDependencies' in parsedJSON
          ? Object.keys(parsedJSON.peerDependencies)
          : [],
    }
  })
}

export default async function getPackageStats(
  packageString: string,
  options: GetPackageStatsOptions = {}
) {
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
          debug: options.debug,
          customImports: options.customImports,
        },
      }),
    ])

    const hasCSSAsset = builtDetails.assets.some(asset => asset.type === 'css')
    const mainAsset = builtDetails.assets.find(
      asset =>
        asset.name === 'main' && asset.type === (hasCSSAsset ? 'css' : 'js')
    )

    if (!mainAsset) {
      throw new UnexpectedBuildError(
        'Did not find a main asset in the built bundle'
      )
    }

    return {
      ...pacakgeJSONDetails,
      ...builtDetails,
      size: mainAsset.size,
      gzip: mainAsset.gzip,
      parse: mainAsset.parse,
    }
  } finally {
    await InstallationUtils.cleaupPath(installPath)
  }
}
