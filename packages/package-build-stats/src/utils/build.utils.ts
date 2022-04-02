import path from 'path'

const log = require('debug')('bp:worker')
import webpack from 'webpack'
import isValidNPMName from 'is-valid-npm-name'
import { gzipSync } from 'zlib'
import fs from 'fs'
import getParseTime from '../getParseTime'
import { performance } from 'perf_hooks'
import { MemoryFS, NodeFS } from '@parcel/fs'

import { Parcel, createWorkerFarm } from '@parcel/core'

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
import { updateProjectPeerDependencies } from './common.utils'
import ThrowableDiagnostic, { Diagnostic } from '@parcel/diagnostic'

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
  entryName: string
  installPath: string
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

type BuiltAssetStat = {
  name: string
  type: string
  size: number
  gzip: number
  parse: { baseParseTime?: number; scriptParseTime?: number } | null
}

type BuildPackageReturn = {
  assets: BuiltAssetStat[]
}

let workerFarm = createWorkerFarm({
  forcedKillTime: 5,
})

let outputFS = new MemoryFS(workerFarm)

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

function isDiagnosticError(error: any): error is ThrowableDiagnostic {
  return 'diagnostics' in error
}

const BuildUtils = {
  createEntryPoint(
    packageName: string,
    installPath: string,
    options: CreateEntryPointOptions
  ) {
    const entryFilename = options.entryFilename || 'index.js'
    const entryPath = path.join(installPath, entryFilename)

    const entryPathHTML = path.join(
      installPath,
      options.entryFilename?.replace('.js', '.html') || 'index.html'
    )

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

    // REMOVE!!!!
    // importStatement = `import { addDays } from '${packageName}'; console.log(addDays)`

    console.log('entryPath', options.entryFilename)
    try {
      fs.writeFileSync(entryPath, importStatement, 'utf-8')
      // fs.writeFileSync(
      //   entryPathHTML,
      //   `<script type="module" src="${entryFilename}">`
      // )
      return entryPath
    } catch (err) {
      throw new EntryPointError(err)
    }
  },

  async _compileEntry({
    entry,
    entryName,
    externals,
    installPath,
  }: CompileEntryArgs): Promise<CompilePackageReturn> {
    await updateProjectPeerDependencies(
      installPath,
      Object.fromEntries(
        [...externals.externalBuiltIns, ...externals.externalPackages].map(
          pack => [pack, '*']
        )
      )
    )

    const altOptions = {}

    let bundler = new Parcel({
      entries: [entry.replace('.js', '.js')],
      mode: 'production',
      logLevel: 'verbose',
      env: Object.assign(Object.assign({}, process.env), {
        NODE_ENV: 'production',
      }),
      defaultConfig: '@parcel/config-default',
      shouldAutoInstall: false,
      workerFarm,
      cacheDir: path.join(__dirname, '..', '..', 'cache'),
      // outputFS,
      config: require.resolve('../../.parcelrc'),
      shouldDisableCache: true,
      shouldContentHash: false,
      defaultTargetOptions: {
        sourceMaps: entry.length === 1,
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

      // @ts-ignore
      // targets: [entryName].reduce((acc, nextEntry) => {
      //   // @ts-ignore
      //   acc[nextEntry] = {
      //     //     context: 'browser',
      //     //     engines: {
      //     //       browsers: [
      //     //         'last 5 Chrome versions',
      //     //         'last 5 Firefox versions',
      //     //         'Safari >= 9',
      //     //         'edge >= 12',
      //     //       ],
      //     //     },
      //     //     optimize: false,
      //     //     // // sourceMap: false, //entry.length > 1,
      //     //     scopeHoist: true,
      //     //     isLibrary: true,
      //     //     // source: entry.replace('.js', '.html'),
      //     //     outputFormat: 'global',
      //     distDir: path.join(installPath, 'dist'),
      //     //     // distEntry: `${entryName}.js`,
      //     //     includeNodeModules: Object.fromEntries(
      //     //       externals.externalPackages.map(dep => [dep, false])
      //     //     ),
      //   }
      //   // return acc
      // }, {}),
    })

    const assets = []
    let { bundleGraph, buildTime } = await bundler.run()
    for (let bundle of bundleGraph.getBundles()) {
      console.log(
        bundle,
        bundle.stats,
        bundle.getMainEntry(),
        bundle.filePath,
        bundle.name
      )
      assets.push({
        file: bundle.filePath,
        size: bundle.stats.size,
      })
      bundle.traverseAssets(asset => {
        asset.getDependencies().map(a => ({
          target: a.target,
          specifier: a.specifier,
          sourcePath: a.sourcePath,
          resolveFrom: a.resolveFrom,
        }))
        let filePath = path.normalize(asset.filePath)
        // console.log(
        //   'ASSET: ',
        //   {
        //     ...asset,
        //     filePath: asset.filePath,
        //     type: asset.type,
        //     isSource: asset.isSource,
        //     meta: asset.meta,
        //     k: asset.symbols,
        //   },
        //   asset.getDependencies().map(a => ({
        //     isEntry: a.isEntry,
        //     sourceAssetType: a.sourceAssetType,
        //     sourcePath: a.sourcePath,
        //   })),
        //   asset.stats
        // )
      })
    }

    return { assets }
  },

  async compilePackage({
    name,
    entry,
    externals,
    debug,
    minifier,
    installPath,
  }: CompilePackageArgs): Promise<CompilePackageReturn> {
    const startTime = performance.now()

    let allAssets: CompiledAssetStat[] = []
    const entries = Object.entries(entry)
    try {
      for (let [entryName, entryPath] of entries.slice(0, 100)) {
        console.log('building entry', entryName, entryPath)
        try {
          const { assets } = await this._compileEntry({
            name,
            entry: entryPath,
            entryName,
            externals,
            installPath,
          })
          allAssets = [...allAssets, ...assets]
        } catch (err) {
          console.log(
            'building entry',
            entryName,
            entryPath,
            ' failed with error ',
            err
          )
          // throw err
        }
      }
      Telemetry.compilePackage(name, true, startTime, { minifier })
      return { assets: allAssets }
    } catch (err) {
      // @ts-ignore
      console.log(
        'Parcel failed because',
        // @ts-ignore

        err.diagnostics,
        // @ts-ignore
        err.diagnostics?.[0]?.codeFrames
      )
      Telemetry.compilePackage(name, false, startTime, { minifier }, err)
      throw err
    }
  },

  _parseMissingModules(errors: Array<Diagnostic>) {
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
  },
  async buildPackage({
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
      entry['mainIndex'] = BuildUtils.createEntryPoint(name, installPath, {
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
      console.log('after compile assets ', assets)
      log('build end %s', name)

      const getAssetStats = (asset: CompiledAssetStat) => {
        if (!asset.file) return null
        const bundleContents = fs.readFileSync(asset.file, 'utf8')
        let parseTimes = null
        if (options.calcParse) {
          parseTimes = getParseTime(bundleContents)
        }
        const gzip = gzipSync(bundleContents, {}).length
        const { ext, name } = path.parse(asset.file)
        return {
          name: name,
          type: ext.slice(1),
          size: asset.size,
          gzip,
          parse: parseTimes,
        }
      }
      const assetStats = assets
        .filter(asset => !!asset.file)
        .map(getAssetStats)
        .filter(notEmpty)
      return {
        assets: assetStats || [],
        ...(options.includeDependencySizes && {
          dependencySizes: require(path.join(installPath, 'composition.json')),
        }),
      }
    } catch (error) {
      if (isDiagnosticError(error)) {
        const missingModules = BuildUtils._parseMissingModules(
          error.diagnostics
        )
        if (missingModules.length) {
          if (missingModules.length === 1 && missingModules[0] === name) {
            throw new EntryPointError(error.diagnostics)
          } else {
            throw new MissingDependencyError(error.diagnostics, {
              missingModules,
            })
          }
        } else {
          throw new BuildError(error)
        }
      } else {
        throw new BuildError(error)
      }
    }
  },
  async buildPackageIgnoringMissingDeps(
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
        e.missingModules.length <= 6 &&
        e.missingModules.every(mod => isValidNPMName(mod)) &&
        buildIteration < 4
      ) {
        const { missingModules } = e.extra
        const newExternals = {
          ...externals,
          externalPackages: externals.externalPackages.concat(missingModules),
        }

        console.log(
          'BUILD ITERATION: ',
          buildIteration,
          'Before externals: ',
          externals,
          'new externals to add: ',
          e.missingModules,
          ' new externals are:',
          newExternals
        )
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
  },
}

export default BuildUtils
