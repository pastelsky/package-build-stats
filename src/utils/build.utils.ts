import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { gzipSync } from 'node:zlib'
import { rspack } from '@rspack/core'
import type { Entry, Stats, StatsOptions } from '@rspack/core'
import isValidNPMName from 'is-valid-npm-name'
import getDependencySizes from '../getDependencySizeTree.js'
import makeRspackConfig from '../config/makeRspackConfig.js'
import {
  EntryPointError,
  MissingDependencyError,
  UnexpectedBuildError,
} from '../errors/CustomError.js'
import type {
  Externals,
  BuildPackageOptions,
  CreateEntryPointOptions,
} from '../common.types.js'
import Telemetry from './telemetry.utils.js'

type CompilePackageArgs = {
  name: string
  externals: Externals
  entry: Entry
  debug?: boolean
  minify?: boolean
  outputPath: string
}

type CompilePackageReturn = {
  stats: Stats
  error: Error | null
}

type Compiler = NonNullable<ReturnType<typeof rspack>>

type BuildPackageArgs = {
  name: string
  installPath: string
  externals: Externals
  options: BuildPackageOptions
}

type BuildPackageResult = {
  assets: Array<{
    name: string
    type: string
    size: number
    gzip: number
  }>
  dependencySizes?: Array<{
    name: string
    approximateSize: number
  }>
}

type BuildPackageResultWithIgnored = BuildPackageResult & {
  ignoredMissingDependencies?: Array<string>
}

type RspackStatsCompilation = ReturnType<Stats['toJson']>
type RspackStatsAsset = NonNullable<RspackStatsCompilation['assets']>[0]

const ASSET_STATS_OPTIONS: StatsOptions = {
  all: false,

  assets: true,
  cachedAssets: true,
  assetsSpace: Number.POSITIVE_INFINITY,
  assetsSort: '!size',
}

const DEPENDENCY_STATS_OPTIONS: StatsOptions = {
  ...ASSET_STATS_OPTIONS,

  modules: true,
  cachedModules: true,
  orphanModules: true,
  dependentModules: true,
  runtimeModules: true,
  nestedModules: true,
  source: true,

  depth: true,
  modulesSort: 'depth',
  modulesSpace: Number.POSITIVE_INFINITY,
  nestedModulesSpace: Number.POSITIVE_INFINITY,
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

function getCompilationErrors(stats: Stats) {
  return [...stats.compilation.errors].filter(notEmpty).flat()
}

function closeCompiler(compiler: Compiler) {
  return new Promise<void>((resolve, reject) => {
    compiler.close(error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

const BuildUtils = {
  createEntryPoint(
    packageName: string,
    installPath: string,
    options: CreateEntryPointOptions,
  ) {
    const entryPath = path.join(
      installPath,
      options.entryFilename || 'index.js',
    )

    let importStatement: string

    if (options.esm) {
      if (options.customImports) {
        importStatement = `
          import { ${options.customImports.join(', ')} } from '${packageName}'; 
          console.log(${options.customImports.join(', ')})
     `
      } else {
        importStatement = `import * as p from '${packageName}'; console.log(p)`
      }
    } else {
      if (options.customImports) {
        importStatement = `
        const { ${options.customImports.join(
          ', ',
        )} } = require('${packageName}'); 
        console.log(${options.customImports.join(', ')})
        `
      } else {
        importStatement = `const p = require('${packageName}'); console.log(p)`
      }
    }

    try {
      fs.writeFileSync(entryPath, importStatement, 'utf-8')
      return entryPath
    } catch (err) {
      throw new EntryPointError(err)
    }
  },

  compilePackage({
    name,
    entry,
    externals,
    debug,
    minify,
    outputPath,
  }: CompilePackageArgs) {
    const startTime = performance.now()

    const options = makeRspackConfig({
      packageName: name,
      entry,
      externals,
      debug,
      minify,
      outputPath,
    })

    const compiler = rspack(options)

    return new Promise<CompilePackageReturn>((resolve, reject) => {
      compiler.run(async (error, stats) => {
        try {
          if (!stats) {
            throw new Error('stats is null')
          }

          await closeCompiler(compiler)

          if (error) {
            console.error(error)
            Telemetry.compilePackage(name, false, startTime, {}, error)
          } else {
            Telemetry.compilePackage(name, true, startTime, {})
          }

          resolve({ stats, error })
        } catch (closeError) {
          reject(closeError)
        }
      })
    })
  },

  parseMissingModules(errors: ReturnType<typeof getCompilationErrors>) {
    // There's a better way to get the missing module's name, maybe ?
    const missingModuleRegex = /Can't resolve '(.+)' in/

    const missingModules = errors.map(err => {
      const matches = err.message.match(missingModuleRegex)

      if (!matches) {
        throw new UnexpectedBuildError(
          'Expected to find a file path in the module not found error, but found none. Regex for this might be out of date.',
        )
      }

      const missingFilePath = matches[1]
      let packageNameMatch
      if (missingFilePath.startsWith('@')) {
        packageNameMatch = missingFilePath.match(/@[^/]+\/[^/]+/) // @babel/runtime/object/create -> @babel/runtime
      } else {
        packageNameMatch = missingFilePath.match(/[^/]+/) // babel-runtime/object/create -> babel-runtime
      }

      if (!packageNameMatch) {
        throw new UnexpectedBuildError(
          'Failed to resolve the missing package name. Regex for this might be out of date.',
        )
      }

      return packageNameMatch[0]
    })

    let uniqueMissingModules = Array.from(new Set(missingModules))
    uniqueMissingModules = uniqueMissingModules.filter(
      mod => !mod.startsWith(`${uniqueMissingModules[0]}/`),
    )

    return uniqueMissingModules
  },

  async buildPackage({
    name: packageName,
    installPath,
    externals,
    options,
  }: BuildPackageArgs) {
    const outputPath = path.join(installPath, 'build')
    let entry: any = {}

    if (options.splitCustomImports) {
      if (!options.customImports || !options.customImports.length) {
        return { assets: [] }
      }
      options.customImports.forEach(importt => {
        entry[importt] = BuildUtils.createEntryPoint(packageName, installPath, {
          customImports: [importt],
          entryFilename: importt,
          esm: true,
        })
      })
    } else {
      entry['main'] = BuildUtils.createEntryPoint(packageName, installPath, {
        esm: true,
        customImports: options.customImports,
      })
    }

    const { stats } = await BuildUtils.compilePackage({
      name: packageName,
      entry,
      externals,
      debug: options.debug,
      minify: options.minify,
      outputPath,
    })

    const compilationErrors = getCompilationErrors(stats)

    if (compilationErrors.length) {
      const missingModules = BuildUtils.parseMissingModules(compilationErrors)

      if (missingModules.length === 1 && missingModules[0] === packageName) {
        throw new EntryPointError(compilationErrors.map(err => err.message))
      }

      throw new MissingDependencyError(
        compilationErrors.map(err => err.toString()),
        { missingModules },
      )
    }

    const jsonStatsStartTime = performance.now()
    const jsonStats = stats.toJson(
      options.includeDependencySizes
        ? DEPENDENCY_STATS_OPTIONS
        : ASSET_STATS_OPTIONS,
    )

    if (!jsonStats) {
      Telemetry.parseWebpackStats(packageName, false, jsonStatsStartTime)
      throw new UnexpectedBuildError(
        'Expected webpack json stats to be non-null, but was null',
      )
    } else {
      Telemetry.parseWebpackStats(packageName, true, jsonStatsStartTime)
    }

    const getAssetStats = async (asset: RspackStatsAsset) => {
      const bundle = path.join(outputPath, asset.name)
      const bundleContents = await fs.promises.readFile(bundle)
      const gzip = gzipSync(bundleContents, {}).length
      const matches = asset.name.match(/(.+?)\.bundle\.(.+)$/)

      if (!matches) {
        throw new UnexpectedBuildError(
          'Found an asset without the `.bundle` suffix. ' +
            'A loader customization might be needed to recognize this asset type' +
            asset.name,
        )
      }

      const [, entryName, extension] = matches

      return {
        name: entryName,
        type: extension,
        size: asset.size,
        gzip,
      }
    }

    const assetStatsPromises =
      jsonStats?.assets
        ?.filter(
          asset =>
            !asset.chunkNames?.some(
              name =>
                name === 'runtime' ||
                (typeof name === 'string' && name.startsWith('runtime~')),
            ),
        )
        .filter(
          asset =>
            typeof asset.name === 'string' &&
            !asset.name.endsWith('LICENSE.txt'),
        )
        .map(getAssetStats) || []
    const assetStats = await Promise.all(assetStatsPromises)
    Telemetry.assetsGZIPParseTime(packageName, performance.now())

    let dependencySizeResults = {}
    if (options.includeDependencySizes) {
      const dependencySizes = await getDependencySizes(packageName, jsonStats)
      dependencySizeResults = {
        dependencySizes,
      }
    }

    return {
      assets: assetStats || [],
      ...dependencySizeResults,
    }
  },
  async buildPackageIgnoringMissingDeps({
    name,
    externals,
    installPath,
    options,
  }: BuildPackageArgs): Promise<BuildPackageResultWithIgnored> {
    const buildStartTime = performance.now()
    let buildIteration = 1

    try {
      const buildResult = await BuildUtils.buildPackage({
        name,
        externals,
        installPath,
        options,
      })
      Telemetry.buildPackage(name, true, buildStartTime, {
        ...options,
        buildIteration,
      })
      return buildResult
    } catch (e) {
      buildIteration++
      if (
        e instanceof MissingDependencyError &&
        e.missingModules.length <= 6 &&
        e.missingModules.every(mod => isValidNPMName(mod))
      ) {
        const { missingModules } = e
        const newExternals = {
          ...externals,
          externalPackages: externals.externalPackages.concat(missingModules),
        }

        const rebuiltResult = await BuildUtils.buildPackage({
          name,
          externals: newExternals,
          installPath,
          options,
        })

        Telemetry.buildPackage(name, true, buildStartTime, {
          ...options,
          buildIteration,
          missingModules,
        })

        return {
          ignoredMissingDependencies: missingModules,
          ...rebuiltResult,
        }
      } else {
        Telemetry.buildPackage(
          name,
          false,
          buildStartTime,
          {
            ...options,
            buildIteration,
          },
          e,
        )
        throw e
      }
    }
  },
}
export default BuildUtils
