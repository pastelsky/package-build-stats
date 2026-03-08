import path from 'path'

import getDependencySizes from '../../src/getDependencySizeTree.js'
import BuildUtils from '../../src/utils/build.utils.js'
import InstallationUtils from '../../src/utils/installation.utils.js'
import { getExternals, parsePackageString } from '../../src/utils/common.utils.js'

const originalStatsOptions = {
  assets: true,
  source: true,
  chunks: false,
  chunkGroups: false,
  chunkModules: true,
  modules: true,
  nestedModules: true,
  reasons: true,
  depth: true,
  errors: true,
  entrypoints: false,
  warnings: false,
}

const reducedStatsOptions = {
  assets: true,
  source: true,
  chunks: false,
  chunkGroups: false,
  modules: true,
  nestedModules: true,
  errors: true,
  entrypoints: false,
  warnings: false,
}

function normalizeAssets(stats: { assets?: Array<any> }) {
  return (stats.assets || [])
    .filter(asset => typeof asset?.name === 'string')
    .filter(asset => !asset.name.endsWith('LICENSE.txt'))
    .map(asset => ({
      name: asset.name,
      size: asset.size,
      chunkNames: asset.chunkNames || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function compareStatsFields(fixturePath: string) {
  const { name: packageName, isLocal } = parsePackageString(fixturePath)
  const installPath = await InstallationUtils.preparePath(packageName)

  try {
    await InstallationUtils.installPackage(fixturePath, installPath, {
      client: 'npm',
      isLocal,
    })
    const externals = getExternals(packageName, installPath)
    const entry = {
      main: BuildUtils.createEntryPoint(packageName, installPath, {
        esm: true,
      }),
    }

    const { stats } = await BuildUtils.compilePackage({
      name: packageName,
      entry,
      externals,
      minify: true,
    })

    const originalStats = stats.toJson(originalStatsOptions)
    const reducedStats = stats.toJson(reducedStatsOptions)

    const [originalDeps, reducedDeps] = await Promise.all([
      getDependencySizes(packageName, originalStats),
      getDependencySizes(packageName, reducedStats),
    ])

    return {
      originalDeps,
      reducedDeps,
      originalAssets: normalizeAssets(originalStats),
      reducedAssets: normalizeAssets(reducedStats),
    }
  } finally {
    await InstallationUtils.cleanupPath(installPath)
  }
}

describe('Rspack stats field reduction', () => {
  test.each([
    '../../fixtures/node_modules/resolve-test',
    '../fixtures/sizes/medium',
    '../fixtures/dependencies/nested-deps',
  ])('preserves dependency analysis for %s', async fixture => {
    const fixturePath = path.resolve(__dirname, fixture)
    const {
      originalDeps,
      reducedDeps,
      originalAssets,
      reducedAssets,
    } = await compareStatsFields(fixturePath)

    expect(reducedDeps).toEqual(originalDeps)
    expect(reducedAssets).toEqual(originalAssets)
  })
})
