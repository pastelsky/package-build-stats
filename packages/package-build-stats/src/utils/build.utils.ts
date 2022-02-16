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
    const entryPath = path.join(
      installPath,
      options.entryFilename || 'index.js'
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

    try {
      fs.writeFileSync(entryPath, importStatement, 'utf-8')
      return entryPath
    } catch (err) {
      throw new EntryPointError(err)
    }
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
    const nodeFS = new NodeFS()
    const externalDeps = await updateProjectPeerDependencies(
      installPath,
      Object.fromEntries(
        externals.externalPackages.map(packageName => [packageName, '*'])
      )
    )

    // @ts-ignore
    // @ts-ignore
    // @ts-ignore

    console.log('entry is ', entry)
    let bundler = new Parcel({
      entries: entry.mainIndex,
      mode: 'production',
      logLevel: 'verbose',
      env: Object.assign(Object.assign({}, process.env), {
        NODE_ENV: 'production',
      }),
      defaultConfig: '@parcel/config-default',
      shouldAutoInstall: false,
      workerFarm,
      // outputFS,
      config: require.resolve('../../.parcelrc'),
      shouldDisableCache: true,
      shouldContentHash: false,
      defaultTargetOptions: {
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
      targets: {
        ...Object.fromEntries(
          Object.entries(entry).map(([entryName, entrySource]) => [
            entryName,
            {
              context: 'browser',
              optimize: true,
              sourceMap: true,
              scopeHoist: true,
              isLibrary: false,
              outputFormat: 'commonjs',
              distDir: path.join(installPath, 'dist'),
              distEntry: `${entryName}.js`,
              includeNodeModules: Object.fromEntries(
                externals.externalPackages.map(dep => [dep, false])
              ),
              // @ts-ignore
              source: 22, //() => 'ok', //path.relative(installPath, entrySource),
            },
          ])
        ),
      },
    })

    const assets = []
    try {
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
      Telemetry.compilePackage(name, true, startTime, { minifier })
    } catch (err) {
      console.log('Parcel failed becase ', err)
      Telemetry.compilePackage(name, false, startTime, { minifier }, err)
      throw err
    }
    return { assets }
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
          entryFilename: importt,
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
  async buildPackageIgnoringMissingDeps({
    name,
    externals,
    installPath,
    options,
  }: BuildPackageArgs) {
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
        log(
          '%s has missing dependencies, rebuilding without %o',
          name,
          missingModules
        )
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
          e
        )
        throw e
      }
    }
  },
}

export default BuildUtils
