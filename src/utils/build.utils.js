const path = require('path')
const debug = require('debug')('bp:worker')
const webpack = require('webpack')
const MemoryFS = require('memory-fs')
const isValidNPMName = require('is-valid-npm-name')
const { gzipSync } = require('zlib')
const fs = require('fs')

const getDependencySizes = require('../getDependencySizeTree')
const getParseTime = require('../getParseTime')
const makeWebpackConfig = require('../webpack.config')
const CustomError = require('../CustomError')

const BuildUtils = {
  createEntryPoint(packageName, installPath, options) {
    const entryPath = path.join(
      installPath,
      options.entryFilename || 'index.js'
    )

    let importStatement

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
      throw new CustomError('EntryPointError', err)
    }
  },

  compilePackage({ entry, externals }) {
    const compiler = webpack(makeWebpackConfig({ entry, externals }))
    const memoryFileSystem = new MemoryFS()
    compiler.outputFileSystem = memoryFileSystem

    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        // stats object can be empty if there are build errors
        resolve({ stats, err, memoryFileSystem })
      })
    })
  },

  _parseMissingModules(errors) {
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
      const missingFilePath = matches[1]

      if (missingFilePath.startsWith('@')) {
        return missingFilePath.match(/@[^\/]+\/[^\/]+/)[0] // @babel/runtime/object/create -> @babel/runtime
      } else {
        return missingFilePath.match(/[^\/]+/)[0] // babel-runtime/object/create -> babel-runtime
      }
    })

    let uniqueMissingModules = Array.from(new Set(missingModules))
    uniqueMissingModules = uniqueMissingModules.filter(
      mod => !mod.startsWith(`${uniqueMissingModules[0]}/`)
    )

    return uniqueMissingModules
  },

  async buildPackage({ name, installPath, externals, options }) {
    let entry = {}
    if (options.splitCustomImports) {
      if (!options.customImports.length) {
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
        esm: false,
        customImports: options.customImports,
      })
    }

    debug('build start %s', name)
    const { stats, err, memoryFileSystem } = await BuildUtils.compilePackage({
      entry,
      externals,
    })

    debug('build end %s', name)

    let jsonStats = stats
      ? stats.toJson({
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
          maxModules: 500,
          performance: false,
          source: true,
          depth: true,
          providedExports: true,
          warnings: false,
          modulesSort: 'depth',
        })
      : {}

    if (err && err.details && !stats) {
      throw new CustomError('BuildError', err.details, {
        name: err.name,
        message: err.error,
      })
    } else if (stats.compilation.errors && stats.compilation.errors.length) {
      const missingModules = BuildUtils._parseMissingModules(
        stats.compilation.errors
      )

      if (missingModules.length) {
        if (missingModules.length === 1 && missingModules[0] === name) {
          throw new CustomError(
            'EntryPointError',
            stats.compilation.errors.map(err => err.toString())
          )
        } else {
          throw new CustomError(
            'MissingDependencyError',
            stats.compilation.errors.map(err => err.toString()),
            { missingModules }
          )
        }
      } else if (jsonStats.errors && jsonStats.errors.length > 0) {
        if (
          jsonStats.errors.some(error =>
            error.includes("Unexpected character '#'")
          )
        ) {
          throw new CustomError('CLIBuildError', jsonStats.errors)
        } else {
          throw new CustomError('BuildError', jsonStats.errors)
        }
      }
    } else {
      const getAssetStats = asset => {
        const bundle = path.join(process.cwd(), 'dist', asset.name)
        const bundleContents = memoryFileSystem.readFileSync(bundle)
        let parseTimes = null
        if (options.calcParse) {
          parseTimes = getParseTime(bundleContents)
        }

        const gzip = gzipSync(bundleContents, {}).length
        const [fullName, entryName, extension] = asset.name.match(
          /(.+?)\.bundle\.(.+)$/
        )
        return {
          name: entryName,
          type: extension,
          size: asset.size,
          gzip,
          parse: parseTimes,
        }
      }

      const assetStats = jsonStats.assets
        .filter(asset => !asset.chunkNames.includes('runtime'))
        .filter(asset => !asset.name.endsWith('LICENSE'))
        .map(getAssetStats)

      debug('build result %O', assetStats)
      return {
        assets: assetStats,
        ...(!options.customImports && {
          dependencySizes: getDependencySizes(jsonStats),
        }),
      }
    }
  },

  async buildPackageIgnoringMissingDeps({
    name,
    externals,
    installPath,
    options,
  }) {
    try {
      return await BuildUtils.buildPackage({
        name,
        externals,
        installPath,
        options,
      })
    } catch (e) {
      if (
        e.name === 'MissingDependencyError' &&
        e.extra.missingModules.length <= 6 &&
        e.extra.missingModules.every(mod => isValidNPMName(mod) === true)
      ) {
        const { missingModules } = e.extra
        const newExternals = {
          ...externals,
          externalPackages: externals.externalPackages.concat(missingModules)
        }
        debug(
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

module.exports = BuildUtils
