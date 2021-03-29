import path from 'path'

const log = require('debug')('bp:worker')
import webpack, { Entry, StatsCompilation } from 'webpack'
import MemoryFS from 'memory-fs'
import isValidNPMName from 'is-valid-npm-name'
import { gzipSync } from 'zlib'
import fs from 'fs'
import getDependencySizes from '../getDependencySizeTree'
import getParseTime from '../getParseTime'
import makeWebpackConfig from '../config/makeWebpackConfig'

type StatsAsset = NonNullable<StatsCompilation['assets']>[0];

import {
  BuildError,
  CLIBuildError,
  EntryPointError,
  MissingDependencyError,
  UnexpectedBuildError,
} from '../errors/CustomError'
import {
  Externals,
  WebpackError,
  BuildPackageOptions,
  CreateEntryPointOptions,
} from '../common.types'

type CompilePackageArgs = {
  name: string
  externals: Externals
  entry: Entry
  debug?: boolean
}

type CompilePackageReturn = {
  stats: webpack.Stats
  error: WebpackError
  memoryFileSystem: MemoryFS
}

type BuildPackageArgs = {
  name: string
  installPath: string
  externals: Externals
  options: BuildPackageOptions
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

  compilePackage({ name, entry, externals, debug }: CompilePackageArgs) {
    const compiler = webpack(
      makeWebpackConfig({ packageName: name, entry, externals, debug })
    )
    const memoryFileSystem = new MemoryFS()
    compiler.outputFileSystem = memoryFileSystem as any

    return new Promise<CompilePackageReturn>(resolve => {
      compiler.run((err, stats) => {
        const error = (err as unknown) as WebpackError // Webpack types incorrect
        // stats object can be empty if there are build errors
        resolve({ stats: stats!, error, memoryFileSystem })
      })
    })
  },

  _parseMissingModules(errors: Array<WebpackError>) {
    const missingModuleErrors = errors.filter(
      error => error.name === 'ModuleNotFoundError'
    )

    if (!missingModuleErrors.length) {
      return []
    }

    // There's a better way to get the missing module's name, maybe ?
    const missingModuleRegex = /Can't resolve '(.+)' in/

    const missingModules = missingModuleErrors.map(err => {
      const matches = err.error.toString().match(missingModuleRegex)

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
  }: BuildPackageArgs) {
    let entry: Entry = {}

    if (options.splitCustomImports) {
      if (!options.customImports || !options.customImports.length) {
        return { assets: [] }
      }
      options.customImports.forEach(importt => {
        ;(entry as any)[importt] = BuildUtils.createEntryPoint(
          name,
          installPath,
          {
            customImports: [importt],
            entryFilename: importt,
            esm: true,
          }
        )
      })
    } else {
      entry['main'] = BuildUtils.createEntryPoint(name, installPath, {
        esm: false,
        customImports: options.customImports,
      })
    }

    log('build start %s', name)
    const { stats, error, memoryFileSystem } = await BuildUtils.compilePackage({
      name,
      entry,
      externals,
      debug: options.debug,
    })

    log('build end %s', name)

    let jsonStats = stats.toJson({
      assets: true,
      children: false,
      chunks: false,
      chunkGroups: false,
      chunkModules: false,
      chunkOrigins: false,
      modules: true,
      errorDetails: false,
      entrypoints: false,
      reasons: false,
      modulesSpace: 500,
      performance: false,
      source: true,
      depth: true,
      providedExports: true,
      warnings: false,
      modulesSort: 'depth',
    })

    if (!jsonStats) {
      throw new UnexpectedBuildError(
        'Expected webpack json stats to be non-null, but was null'
      )
    }

    if (error && !stats) {
      throw new BuildError(error)
    } else if (stats.compilation.errors && stats.compilation.errors.length) {
      const missingModules = BuildUtils._parseMissingModules(
        stats.compilation.errors as any
      )

      if (missingModules.length) {
        if (missingModules.length === 1 && missingModules[0] === name) {
          throw new EntryPointError(
            stats.compilation.errors.map(err => err.toString())
          )
        } else {
          throw new MissingDependencyError(
            stats.compilation.errors.map(err => err.toString()),
            { missingModules }
          )
        }
      } else if (jsonStats.errors && jsonStats.errors.length > 0) {
        if (
          jsonStats.errors.some((error: any) =>
            error.includes("Unexpected character '#'")
          )
        ) {
          throw new CLIBuildError(jsonStats.errors)
        } else {
          throw new BuildError(jsonStats.errors)
        }
      } else {
        throw new UnexpectedBuildError(
          'The webpack stats object was unexpectedly empty'
        )
      }
    } else {
      const getAssetStats = (asset: StatsAsset) => {
        const bundle = path.join(process.cwd(), 'dist', (asset as any).name)
        const bundleContents = memoryFileSystem.readFileSync(bundle)
        let parseTimes = null
        if (options.calcParse) {
          parseTimes = getParseTime(bundleContents)
        }

        const gzip = gzipSync(bundleContents, {}).length
        const matches = (asset as any).name.match(/(.+?)\.bundle\.(.+)$/)

        if (!matches) {
          throw new UnexpectedBuildError(
            'Found an asset without the `.bundle` suffix. ' +
              'A loader customization might be needed to recognize this asset type' +
              (asset as any).name
          )
        }

        const [, entryName, extension] = matches

        return {
          name: entryName,
          type: extension,
          size: asset.size,
          gzip,
          parse: parseTimes,
        }
      }

      const assetStats = jsonStats?.assets
        ?.filter((asset: any) => !asset.chunkNames.includes('runtime'))
        .filter((asset: any) => !asset.name.endsWith('LICENSE.txt'))
        .map(getAssetStats)

      log('build result %O', assetStats)
      return {
        assets: assetStats || [],
        ...(!options.customImports && {
          dependencySizes: await getDependencySizes(jsonStats),
        }),
      }
    }
  },
  async buildPackageIgnoringMissingDeps({
    name,
    externals,
    installPath,
    options,
  }: BuildPackageArgs) {
    try {
      return await BuildUtils.buildPackage({
        name,
        externals,
        installPath,
        options,
      })
    } catch (e) {
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
        return {
          ignoredMissingDependencies: missingModules,
          ...rebuiltResult,
        }
      } else {
        throw e
      }
    }
  },
}
export default BuildUtils
