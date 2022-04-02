import { Reporter } from '@parcel/plugin'
import { generateBuildMetrics, DefaultMap, AssetStats } from '@parcel/utils'
import path from 'path'
import fs from 'fs/promises'
import { Asset, Dependency, PackagedBundle, PluginOptions } from '@parcel/types'
import {
  getDependencyFromSpecifier,
  getPackageJSONDetails,
  getPackageRoot,
  isPackageSpecifier,
  isSpecifierNotIgnored,
  notEmpty,
  readJSONFileFromFS,
} from './utils'

let graphCache = []
let debug = true

type RequireeDetails = {
  packageName: string
  packageRoot: string
  versionRangeDependency: string | null
  versionRangePeerDependency: string | null
}

/**
 * Gets information about a package from its parent (sourcePath)
 */
const getRequireeDetails = async (
  specifier: string,
  sourcePath: string
): Promise<RequireeDetails> => {
  const specifierName = getDependencyFromSpecifier(specifier)
  const { packageRoot, packageName } = getPackageRoot(sourcePath, specifier)

  const { dependencies, peerDependencies } = await getPackageJSONDetails(
    packageRoot
  )

  return {
    packageRoot,
    packageName,
    versionRangeDependency: dependencies[specifierName],
    versionRangePeerDependency: peerDependencies[specifierName],
  }
}

type RequiredDependency = {
  packageRoot: string
  packageName: string
  resolvedVersion: string
}
/**
 * Gets information about the required dependency, resolved from the main asset path
 */
const resolveRequiredDependency = async (
  specifier: string,
  mainAssetPath: string
): Promise<RequiredDependency | null> => {
  try {
    // TODO: See if this can be replaced with enhanced-resolve or something better
    let resolved = require.resolve(specifier, {
      paths: [mainAssetPath],
    })
    const { packageName, packageRoot } = getPackageRoot(resolved, specifier)
    const { version } = await getPackageJSONDetails(packageRoot)
    return {
      packageRoot,
      packageName,
      resolvedVersion: version,
    }
  } catch (err) {
    // console.warn(
    //   'Unable to resolve required dependency  ' +
    //     specifier +
    //     ' at ' +
    //     mainAssetPath
    // )
    return null
  }
}

type EnrichedAsset = {
  size: number
  filePath: string
  details?: {
    packageName: string
    resolvedVersion: string
    versionRanges: string[]
    requiredBy: string[]
  } | null
}

type ContributionMap = {
  [k: string]: {
    assets: string[]
    totalSize: number
    packageName: string
    versionRanges: string[]
    requiredBy: string[]
    resolvedVersion: string
  }
}

type CompositionConstituent = {
  name: string
  size: number
  versionRanges: string[]
  requiredBy: string[]
  resolvedVersion: string
}

const calculateComposition = (
  assets: EnrichedAsset[]
): CompositionConstituent[] => {
  const contributionMap: ContributionMap = {}

  assets.forEach(asset => {
    if (!asset.details) return
    const assetKey =
      asset.details.packageName + '_$_$_' + asset.details.resolvedVersion

    if (contributionMap[assetKey]) {
      contributionMap[assetKey] = {
        ...contributionMap[assetKey],
        assets: [...contributionMap[assetKey].assets, asset.filePath],
        totalSize: contributionMap[assetKey].totalSize + asset.size,
      }
    } else {
      contributionMap[assetKey] = {
        assets: [asset.filePath],
        totalSize: asset.size,
        packageName: asset.details.packageName,
        versionRanges: asset.details.versionRanges,
        requiredBy: asset.details.requiredBy,
        resolvedVersion: asset.details.resolvedVersion,
      }
    }
  })

  return Object.values(contributionMap).map(composition => ({
    size: composition.totalSize,
    name: composition.packageName,
    versionRanges: composition.versionRanges,
    resolvedVersion: composition.resolvedVersion,
    requiredBy: composition.requiredBy,
  }))
}

type FormattedAsset = {
  type: Asset['type']
  meta: Asset['meta']
  stats: Asset['stats']
  filePath: Asset['filePath']

  dependencies: {
    sourcePath: Dependency['sourcePath']
    specifier: Dependency['specifier']
    resolveFrom: Dependency['resolveFrom']
    sourceAssetType: Dependency['sourceAssetType']
  }[]
}

const formatAssets = (bundle: PackagedBundle): FormattedAsset[] => {
  const assetsAre: FormattedAsset[] = []

  bundle.traverseAssets(asset => {
    assetsAre.push({
      type: asset.type,
      meta: asset.meta,
      stats: asset.stats,
      filePath: asset.filePath,

      dependencies: asset.getDependencies().map(dependency => {
        return {
          sourcePath: dependency.sourcePath,
          specifier: dependency.specifier,
          resolveFrom: dependency.resolveFrom,
          sourceAssetType: dependency.sourceAssetType,
        }
      }),
    })
  })

  return assetsAre
}

type DependencyDetails = {
  assetFilePath: string
  specifier: string
  requiredBy: RequireeDetails
} & RequiredDependency

export default new Reporter({
  async report({ event, options }) {
    if (event.type !== 'buildSuccess') {
      return
    }

    const projectPackageJSON = path.join(options.projectRoot, 'package.json')
    const { peerDependencies = {}, dependencies = {} } =
      await readJSONFileFromFS(options.inputFS, projectPackageJSON)

    const dependenciesTyped = dependencies as { [k: string]: string }

    const mainPackageDetails = {
      packageName: Object.keys(dependenciesTyped)[0],
      packageVersion: Object.values(dependenciesTyped)[0],
    }

    const allBundles = event.bundleGraph.getBundles()
    graphCache = []

    const bundlesFormatted = allBundles.map(bundle => ({
      bundleFilePath: bundle.filePath,
      bundleName: bundle.name,
      assets: formatAssets(bundle),
    }))

    let bundleGraphCache: DependencyDetails[] = []

    const getDependencyDetails = async (
      dependency: FormattedAsset['dependencies'][0],
      assetFilePath: string
    ): Promise<DependencyDetails | null> => {
      if (
        isPackageSpecifier(dependency.specifier) &&
        isSpecifierNotIgnored(dependency.specifier, peerDependencies) &&
        dependency.sourcePath
      ) {
        const requiredDependencyDetails = await resolveRequiredDependency(
          dependency.specifier,
          assetFilePath
        )

        if (!requiredDependencyDetails) return null

        return {
          assetFilePath,
          specifier: dependency.specifier,
          ...requiredDependencyDetails,
          requiredBy: await getRequireeDetails(
            dependency.specifier,
            dependency.sourcePath
          ),
        }
      } else {
        return null
      }
    }

    for (const bundle of bundlesFormatted) {
      bundleGraphCache = []

      const promises = bundle.assets.map(asset =>
        asset.dependencies.map(async dependency => {
          const dependencyDetails = await getDependencyDetails(
            dependency,
            asset.filePath
          )
          if (dependencyDetails) {
            bundleGraphCache.push(dependencyDetails)
          }
        })
      )

      await Promise.all(promises)
    }

    await fs.writeFile(
      './logs/build-results.json',
      JSON.stringify(bundlesFormatted, null, 2),
      'utf8'
    )

    await fs.writeFile(
      './logs/graph-cache.json',
      JSON.stringify(bundleGraphCache, null, 2),
      'utf8'
    )

    await Promise.all(
      allBundles.map(bundle =>
        getBundleNode(bundle, bundleGraphCache, options, mainPackageDetails)
      )
    )
  },
})

function checkForNodePolyfill(assetFilePath: string) {
  const fallback = {
    packageName: '(unknown)',
    resolvedVersion: '0.0.0',
    versionRanges: [],
    requiredBy: [],
  }

  const parts = assetFilePath.split('/')
  if (!parts.includes('node_modules')) return fallback
  const packageName = parts[parts.indexOf('node_modules') + 1]
  // See: https://parceljs.org/features/node-emulation/#polyfilling-%26-excluding-builtin-node-modules
  switch (packageName) {
    case 'buffer':
    case 'assert':
    case 'crypto':
    case 'domain':
    case 'events':
    case 'http':
    case 'https':
    case 'os':
    case 'path':
    case 'zlib':
      return {
        packageName: `(${packageName}-polyfill)`,
        resolvedVersion: '0.0.0',
        versionRanges: [],
        requiredBy: [],
      }
    default:
      return fallback
  }
}

async function getBundleNode(
  bundle: PackagedBundle,
  graphCache: DependencyDetails[],
  options: PluginOptions,
  mainPackageDetails: { packageName: string; packageVersion: string }
) {
  let buildMetrics = await generateBuildMetrics(
    [bundle],
    options.outputFS,
    options.projectRoot
  )

  const augmentAsset = (asset: AssetStats) => {
    const assetRoot = getPackageRoot(asset.filePath, '')
    const matchedGraphCache = graphCache
      .filter(
        graphCacheItem =>
          graphCacheItem.requiredBy.versionRangeDependency ||
          graphCacheItem.requiredBy.versionRangePeerDependency
      )
      .filter(cache => cache.packageRoot === assetRoot.packageRoot)

    if (!matchedGraphCache.length) {
      if (
        ['regenerator-runtime', '@swc/helpers'].includes(assetRoot.packageName)
      ) {
        // These are assets injected by Parcel-SWC transformer, ignore them
        return null
      }
      // console.warn("Couldn't find graph cache for asset: ", asset.filePath)
      return {
        ...asset,
        details: checkForNodePolyfill(asset.filePath),
      }
    }

    const getVersionRange = (details: DependencyDetails): string => {
      const range =
        details.requiredBy.versionRangeDependency ||
        details.requiredBy.versionRangePeerDependency

      if (!range) {
        console.log('WASTE details ', details)
        throw new Error(
          `Couldn't find version range for ${details.assetFilePath}`
        )
      }

      return range
    }

    const getPackageName = (details: DependencyDetails) =>
      details.requiredBy.packageName

    const getResolvedVersion = (details: DependencyDetails) =>
      details.resolvedVersion

    const uniqueVersionRanges = [
      ...new Set(matchedGraphCache.map(getVersionRange)),
    ]
    const uniqueRequiredBy = [...new Set(matchedGraphCache.map(getPackageName))]

    const uniqueResolvedVersions = [
      ...new Set(matchedGraphCache.map(getResolvedVersion)),
    ]

    if (uniqueResolvedVersions.length > 1) {
      throw new Error(`Multiple resolved versions for ${asset.filePath}`)
    }

    return {
      ...asset,
      details: {
        packageName: matchedGraphCache[0].packageName,
        resolvedVersion: matchedGraphCache[0].resolvedVersion,
        versionRanges: uniqueVersionRanges,
        requiredBy: uniqueRequiredBy,
      },
    }
  }

  const assets = buildMetrics.bundles[0].assets
    // Sourcemaps sometimes contain unmapped paths
    // .filter(asset => !!asset.filePath)
    // Filter out the setup file (projectRoot/index.js), because we wrote it to disk already
    .filter(asset => {
      const assetRoot = getPackageRoot(asset.filePath, '')
      // We do a ends with instead of equality because the resolved asset root (e.g /private/tmp/... ) might have
      // extra prefixes over the project root (e.g /tmp/... )
      return !assetRoot.packageRoot.endsWith(options.projectRoot)
    })
    .map(asset => augmentAsset(asset))
    .filter(notEmpty)

  await fs.writeFile(
    `./logs/build-metrics-assets-raw.json`,
    JSON.stringify(buildMetrics.bundles[0].assets, null, 2),
    'utf8'
  )

  await fs.writeFile(
    `./logs/build-metrics-smap-${bundle.name}.json`,
    JSON.stringify(assets, null, 2),
    'utf8'
  )

  const constituents = calculateComposition(assets).sort(
    (a, b) => b.size - a.size
  )

  await fs.writeFile(
    path.join(options.projectRoot, 'composition.json'),
    JSON.stringify(constituents, null, 2),
    'utf8'
  )

  await fs.writeFile(
    './logs/composition.json',
    JSON.stringify(constituents, null, 2),
    'utf8'
  )

  return
}
