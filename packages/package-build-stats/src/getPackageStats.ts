/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */

const log = require('debug')('bp:package-stats')
import { promises as fs } from 'fs'
import path from 'path'
import { getExternals, parsePackageString } from './utils/common.utils'
import InstallationUtils from './utils/installation.utils'
import type { BuildPackageReturn, BuiltAssetStat } from './utils/build.utils'
import BuildUtils from './utils/build.utils'

import { BuildError, UnexpectedBuildError } from './errors/CustomError'
import { GetPackageStatsOptions } from './common.types'
import Telemetry from './utils/telemetry.utils'
import { performance } from 'perf_hooks'

type PackageJSONDetails = {
  dependencyCount: number
  mainFields: string[]
  hasJSNext: boolean | string
  hasJSModule: boolean | string | string[]
  isModuleType: boolean
  hasSideEffects: boolean | string | string[]
  peerDependencies: string[]
}

type PackageStatsResponse = PackageJSONDetails & {
  buildVersion: string
  size: number
  gzip: number
  parse: BuiltAssetStat['parse']
} & BuildPackageReturn

function getPackageJSONDetails(
  packageName: string,
  installPath: string
): Promise<PackageJSONDetails | void> {
  const startTime = performance.now()
  const packageJSONPath = path.join(
    installPath,
    'node_modules',
    packageName,
    'package.json'
  )
  return fs.readFile(packageJSONPath, 'utf8').then(
    (contents: string) => {
      const parsedJSON = JSON.parse(contents)
      Telemetry.getPackageJSONDetails(packageName, true, startTime)

      return {
        dependencyCount:
          'dependencies' in parsedJSON
            ? Object.keys(parsedJSON.dependencies).length
            : 0,
        mainFields: [
          parsedJSON['module'] && 'module',
          parsedJSON['jsnext:main'] && 'jsnext:main',
          parsedJSON['main'] && 'main',
          parsedJSON['style'] && 'style',
        ].filter(Boolean),
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
    },
    err => {
      Telemetry.getPackageJSONDetails(packageName, false, startTime, err)
    }
  )
}

export default async function getPackageStats(
  packageString: string,
  optionsRaw: GetPackageStatsOptions
): Promise<PackageStatsResponse> {
  const startTime = performance.now()
  const defaultMinifier: 'terser' = 'terser'

  const options = {
    minifier: defaultMinifier,
    ...optionsRaw,
  }

  const { name: packageName, isLocal } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(packageName)

  if (options.debug) {
    console.log('Install path:', installPath)
  }
  try {
    await InstallationUtils.installPackage(packageString, installPath, {
      isLocal,
      client: options.client,
      limitConcurrency: options.limitConcurrency,
      networkConcurrency: options.networkConcurrency,
      installTimeout: options.installTimeout,
    })

    const externals = getExternals(packageName, installPath)
    const [packageJSONDetails, builtDetails] = await Promise.all([
      getPackageJSONDetails(packageName, installPath),
      BuildUtils.buildPackageIgnoringMissingDeps(
        {
          name: packageName,
          installPath,
          externals,
          options: {
            debug: options.debug,
            customImports: options.customImports,
            minifier: options.minifier,
            includeDependencySizes: true,
          },
        },
        0
      ),
    ])

    if (!packageJSONDetails) {
      throw new UnexpectedBuildError(
        `Could not get package.json details for ${packageName}`
      )
    }

    if (!builtDetails) {
      throw new BuildError(`Could not get built details for ${packageName}`)
    }

    const isStylePackageOnly =
      packageJSONDetails.mainFields.length === 1 &&
      packageJSONDetails.mainFields[0] === 'style'
    if (isStylePackageOnly) {
      builtDetails.assets = builtDetails.assets?.filter(
        asset => asset?.type !== 'js'
      )
    }

    log(
      'builtDetails are %o %o',
      builtDetails.assets,
      // @ts-ignore
      builtDetails.dependencySizes
    )
    const hasCSSAsset = builtDetails.assets?.some(
      asset => asset?.type === 'css'
    )

    const mainAsset = builtDetails.assets?.find(
      asset =>
        asset?.name === 'index' && asset?.type === (hasCSSAsset ? 'css' : 'js')
    )

    if (!mainAsset) {
      throw new UnexpectedBuildError(
        'Did not find a main asset in the built bundle'
      )
    }

    Telemetry.packageStats(
      packageString,
      true,
      performance.now() - startTime,
      options
    )
    return {
      ...packageJSONDetails,
      ...builtDetails,
      buildVersion: require('../package.json').version,
      size: mainAsset.size,
      gzip: mainAsset.gzip,
      parse: mainAsset.parse,
    }
  } catch (e) {
    Telemetry.packageStats(
      packageString,
      false,
      performance.now() - startTime,
      options
    )
    throw e
  } finally {
    if (!options.debug) {
      await InstallationUtils.cleanupPath(installPath)
    }
  }
}
