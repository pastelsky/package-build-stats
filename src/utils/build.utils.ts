import path from 'path'
import config from '../config/config.js'
import { Entry, rspack } from '@rspack/core'
import isValidNPMName from 'is-valid-npm-name'
import { gzipSync } from 'zlib'
import fs from 'fs'
import getDependencySizes from '../getDependencySizeTree.js'
import makeRspackConfig from '../config/makeRspackConfig.js'
import { performance } from 'perf_hooks'
import type { Stats } from '@rspack/core'

import {
  BuildError,
  CLIBuildError,
  EntryPointError,
  MissingDependencyError,
  UnexpectedBuildError,
} from '../errors/CustomError.js'
import {
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
  installPath?: string
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
    installPath,
  }: CompilePackageArgs) {
    const startTime = performance.now()

    const options = makeRspackConfig({
      packageName: name,
      entry,
      externals,
      debug,
      minify,
      outputPath,
      installPath,
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

  _parseMissingModules(errors: ReturnType<typeof getCompilationErrors>) {
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
    name,
    installPath,
    externals,
    options,
  }: BuildPackageArgs) {
    const outputPath = config.tmp
    let entry: any = {}

    if (options.splitCustomImports) {
      if (!options.customImports || !options.customImports.length) {
        return { assets: [] }
      }
      options.customImports.forEach(importt => {
        entry[importt] = BuildUtils.createEntryPoint(name, installPath, {
          customImports: [importt],
          entryFilename: importt,
          esm: true,
        })
      })
    } else {
      entry['main'] = BuildUtils.createEntryPoint(name, installPath, {
        esm: true,
        customImports: options.customImports,
      })
    }

    const { stats, error } = await BuildUtils.compilePackage({
      name,
      entry,
      externals,
      debug: options.debug,
      minify: options.minify,
      outputPath,
      installPath,
    })

    const jsonStatsStartTime = performance.now()
    let jsonStats = stats.toJson({
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
    })

    if (!jsonStats) {
      Telemetry.parseWebpackStats(name, false, jsonStatsStartTime)
      throw new UnexpectedBuildError(
        'Expected webpack json stats to be non-null, but was null',
      )
    } else {
      Telemetry.parseWebpackStats(name, true, jsonStatsStartTime)
    }

    const compilationErrors = getCompilationErrors(stats)

    if (error && !stats) {
      throw new BuildError(error)
    } else if (compilationErrors.length) {
      const missingModules = BuildUtils._parseMissingModules(compilationErrors)

      if (missingModules.length) {
        if (missingModules.length === 1 && missingModules[0] === name) {
          throw new EntryPointError(compilationErrors.map(err => err.message))
        } else {
          throw new MissingDependencyError(
            compilationErrors.map(err => err.toString()),
            { missingModules },
          )
        }
      } else if (jsonStats.errors && jsonStats.errors.length > 0) {
        if (
          jsonStats.errors.some(error =>
            error.message.includes("Unexpected character '#'"),
          )
        ) {
          throw new CLIBuildError(jsonStats.errors)
        } else {
          throw new BuildError(jsonStats.errors)
        }
      } else {
        throw new UnexpectedBuildError(
          'The webpack stats object was unexpectedly empty',
        )
      }
    } else {
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
      Telemetry.assetsGZIPParseTime(name, performance.now())

      let dependencySizeResults = {}
      if (options.includeDependencySizes) {
        const dependencySizes = await getDependencySizes(name, jsonStats)
        dependencySizeResults = {
          dependencySizes,
        }
      }

      return {
        assets: assetStats || [],
        ...dependencySizeResults,
      }
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
        const { missingModules } = e.extra
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
