import path from 'path'

const log = require('debug')('bp:worker')
import isValidNPMName from 'is-valid-npm-name'
import fs from 'fs'
import getParseTime from '../getParseTime'
import { performance } from 'perf_hooks'
import { gzip } from 'node-gzip'
import { Parcel } from '@parcel/core'

import {
  BuildError,
  CLIBuildError,
  EntryPointError,
  MissingDependencyError,
  UnexpectedBuildError,
} from '../errors/CustomError'
import {
  Externals,
  BuildPackageOptions,
  CreateEntryPointOptions,
} from '../common.types'
import Telemetry from './telemetry.utils'
import {
  printDiagnosticError,
  updateMeasureComposition,
  updateProjectPeerDependencies,
} from './common.utils'
import ThrowableDiagnostic, { Diagnostic } from '@parcel/diagnostic'
import config from '../config'
import pAll from 'p-all'

type CompilePackageArgs = {
  name: string
  externals: Externals
  entry: EntryObject
  debug?: boolean
  minifier: 'terser' | 'esbuild'
  installPath: string
}

type CompileEntryArgs = {
  name: string
  externals: Externals
  entry: any
  installPath: string
  measureComposition: boolean
}

type BuildPackageArgs = {
  name: string
  installPath: string
  externals: Externals
  options: BuildPackageOptions
}

type EntryObject = {
  [key: string]: string
}

type CompiledAssetStat = {
  file: string
  size: number
}
type CompilePackageReturn = {
  assets: CompiledAssetStat[]
}

export type BuiltAssetStat = {
  name: string
  type: string
  size: number
  gzip: number
  parse: { baseParseTime?: number; scriptParseTime?: number } | null
}

export type BuildPackageReturn = {
  assets: BuiltAssetStat[]
  dependencySizes?: {
    size: number
    name: string
    versionRanges: string[]
    resolvedVersion: string
    requiredBy: string[]
  }[]
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

function isDiagnosticError(error: any): error is ThrowableDiagnostic {
  return 'diagnostics' in error
}

function parseMissingModules(errors: Diagnostic[]) {
  const missingModuleErrors = errors.filter(
    error =>
      error.message.startsWith('Failed to resolve') &&
      error.origin === '@parcel/core'
  )
  if (!missingModuleErrors.length) {
    return []
  }
  // There's a better way to get the missing module's name, maybe ?
  const missingModuleRegex = /Failed to resolve '(.+)' from/
  const missingModules = missingModuleErrors.map(err => {
    const matches = err.message.match(missingModuleRegex)
    if (!matches) {
      throw new UnexpectedBuildError(
        'Expected to find a file path in the module not found error, but found none. Regex for this might be out of date.'
      )
    }
    const missingFilePath = matches[1]
    let packageNameMatch
    if (missingFilePath.startsWith('@')) {
      packageNameMatch = missingFilePath.match(/@[^\/]+\/[^\/]+/) // @babel/runtime/object/create -> @babel/runtime
    } else {
      packageNameMatch = missingFilePath.match(/[^\/]+/) // babel-runtime/object/create -> babel-runtime
    }
    if (!packageNameMatch) {
      throw new UnexpectedBuildError(
        'Failed to resolve the missing package name. Regex for this might be out of date.'
      )
    }
    return packageNameMatch[0]
  })
  let uniqueMissingModules = Array.from(new Set(missingModules))
  uniqueMissingModules = uniqueMissingModules.filter(
    mod => !mod.startsWith(`${uniqueMissingModules[0]}/`)
  )
  return uniqueMissingModules
}

async function getAssetStats(
  assets: CompiledAssetStat[],
  options: BuildPackageOptions
) {
  const getAssetStats = async (asset: CompiledAssetStat) => {
    if (!asset.file) return null
    const bundleContents = fs.readFileSync(asset.file, 'utf8')
    let parseTimes = null
    if (options.calcParse) {
      parseTimes = getParseTime(bundleContents)
    }
    const gzipSize = (await gzip(bundleContents)).length
    const { ext, name } = path.parse(asset.file)
    return {
      name: name,
      type: ext.slice(1),
      size: asset.size,
      gzip: gzipSize,
      parse: parseTimes,
    }
  }
  const assetStatsPromises = assets
    .filter(asset => !!asset.file)
    .map(getAssetStats)

  const assetStats = (await Promise.all(assetStatsPromises)).filter(notEmpty)

  return assetStats
}

class BuildUtils {
  static createEntryPoint(
    packageName: string,
    installPath: string,
    options: CreateEntryPointOptions
  ) {
    const entryFilename = options.entryFilename || 'index.js'
    const entryPath = path.join(installPath, entryFilename)

    let importStatement: string

    if (options.esm) {
      if (options.customImports) {
        importStatement = `
          import { ${options.customImports.join(', ')} } from '${packageName}'; 
          console.log(${options.customImports.join(', ')})
     `
      } else {
        importStatement = `import p from '${packageName}'; console.log(p)`
      }
    } else {
      if (options.customImports) {
        importStatement = `
        const { ${options.customImports.join(
          ', '
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
  }

  static async compileEntry({
    entry,
    externals,
    installPath,
    measureComposition,
  }: CompileEntryArgs): Promise<CompilePackageReturn> {
    await updateProjectPeerDependencies(
      installPath,
      Object.fromEntries(
        [...externals.externalBuiltIns, ...externals.externalPackages].map(
          pack => [pack, '*']
        )
      )
    )

    await updateMeasureComposition(installPath, measureComposition)

    let bundler = new Parcel({
      entries: [entry],
      mode: 'production',
      env: Object.assign(Object.assign({}, process.env), {
        NODE_ENV: 'production',
      }),
      defaultConfig: '@parcel/config-default',
      shouldAutoInstall: false,
      cacheDir: path.join(config.tmp, 'parcel-cache'),
      config: require.resolve(path.join(__dirname, '..', '..', '.parcelrc')),
      shouldDisableCache: true,
      shouldContentHash: false,
      defaultTargetOptions: {
        sourceMaps: measureComposition,
        outputFormat: 'global',
        shouldOptimize: true,
        isLibrary: false,
        engines: {
          browsers: [
            'last 5 Chrome versions',
            'last 5 Firefox versions',
            'Safari >= 9',
            'edge >= 12',
          ],
        },
      },
    })

    const assets = []
    let { bundleGraph } = await bundler.run()
    for (let bundle of bundleGraph.getBundles()) {
      assets.push({
        file: bundle.filePath,
        size: bundle.stats.size,
      })
    }

    return { assets }
  }

  static async compilePackage({
    name,
    entry,
    externals,
    minifier,
    installPath,
  }: CompilePackageArgs): Promise<CompilePackageReturn> {
    const startTime = performance.now()

    let allAssets: CompiledAssetStat[] = []
    const entries = Object.values(entry)
    const entryPromises = entries.map(entry => async () => {
      const { assets } = await BuildUtils.compileEntry({
        name,
        entry,
        measureComposition: entries.length === 1,
        externals,
        installPath,
      })
      log('Building entry %s', entry)
      allAssets = [...allAssets, ...assets]
    })

    try {
      await pAll(entryPromises, { concurrency: 1 })
      Telemetry.compilePackage(name, true, startTime, { minifier })
      return { assets: allAssets }
    } catch (err) {
      if (isDiagnosticError(err)) {
        printDiagnosticError(err)
      } else {
        console.error(err)
      }
      Telemetry.compilePackage(name, false, startTime, { minifier }, err)
      throw err
    }
  }

  static async buildPackage({
    name,
    installPath,
    externals,
    options,
  }: BuildPackageArgs): Promise<BuildPackageReturn> {
    let entry: EntryObject = {}

    if (options.splitCustomImports) {
      if (!options.customImports || !options.customImports.length) {
        return { assets: [] }
      }

      options.customImports.forEach((importt: string) => {
        entry[importt] = BuildUtils.createEntryPoint(name, installPath, {
          customImports: [importt],
          entryFilename: `${importt}.js`,
          esm: true,
        })
      })
    } else {
      entry['main'] = BuildUtils.createEntryPoint(name, installPath, {
        esm: false,
        customImports: options.customImports,
      })
    }

    log('build start %s', name)

    try {
      const { assets } = await BuildUtils.compilePackage({
        name,
        entry,
        installPath,
        externals,
        debug: options.debug,
        minifier: options.minifier,
      })

      log('build end %s', name)
      log('after compile assets %o', assets)

      const assetStats = await getAssetStats(assets, options)
      return {
        assets: assetStats || [],
        ...(options.includeDependencySizes && {
          dependencySizes: require(path.join(installPath, 'composition.json')),
        }),
      }
    } catch (error) {
      if (isDiagnosticError(error)) {
        const missingModules = parseMissingModules(error.diagnostics)
        if (missingModules.length) {
          if (missingModules.length === 1 && missingModules[0] === name) {
            throw new EntryPointError(error.diagnostics)
          } else {
            throw new MissingDependencyError(error.diagnostics, {
              missingModules,
            })
          }
        }
      }
      throw new BuildError(error)
    }
  }

  static async buildPackageIgnoringMissingDeps(
    { name, externals, installPath, options }: BuildPackageArgs,
    buildIteration: number
  ): Promise<BuildPackageReturn> {
    const buildStartTime = performance.now()

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
        e.missingModules.every(mod => isValidNPMName(mod)) &&
        buildIteration < 4
      ) {
        const { missingModules } = e.extra
        const newExternals = {
          ...externals,
          externalPackages: externals.externalPackages.concat(missingModules),
        }
        log(
          '%s has missing dependencies, rebuilding without %o',
          name,
          missingModules
        )
        const rebuiltResults = await BuildUtils.buildPackageIgnoringMissingDeps(
          {
            name,
            externals: newExternals,
            installPath,
            options,
          },
          buildIteration
        )

        Telemetry.buildPackage(name, true, buildStartTime, {
          ...options,
          buildIteration,
          missingModules,
        })

        return rebuiltResults
      } else {
        Telemetry.buildPackage(
          name,
          false,
          buildStartTime,
          {
            ...options,
            buildIteration,
          },
          e
        )
        throw e
      }
    }
  }
}

export default BuildUtils
