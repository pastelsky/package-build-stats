import webpack from 'webpack'
import path from 'path'
import Terser from 'terser'
import { MinifyError } from './errors/CustomError'

/**
 * A fork of `webpack-bundle-size-analyzer`.
 * https://github.com/robertknight/webpack-bundle-size-analyzer
 */

function modulePath(identifier: string) {
  // the format of module paths is
  //   '(<loader expression>!)?/path/to/module.js'
  let loaderRegex = /.*!/
  return identifier.replace(loaderRegex, '')
}

function getByteLen(normal_val: string) {
  // Force string type
  normal_val = String(normal_val)

  let byteLen = 0
  for (let i = 0; i < normal_val.length; i++) {
    const c = normal_val.charCodeAt(i)
    byteLen +=
      c < 1 << 7
        ? 1
        : c < 1 << 11
        ? 2
        : c < 1 << 16
        ? 3
        : c < 1 << 21
        ? 4
        : c < 1 << 26
        ? 5
        : c < 1 << 31
        ? 6
        : Number.NaN
  }
  return byteLen
}

function minifyDependencyCode(source: string) {
  return Terser.minify(source, {
    mangle: false,
    compress: {
      arrows: true,
      booleans: true,
      collapse_vars: true,
      comparisons: true,
      conditionals: true,
      dead_code: true,
      drop_console: false,
      drop_debugger: true,
      ecma: 5,
      evaluate: true,
      expression: false,
      global_defs: {},
      hoist_vars: false,
      ie8: false,
      if_return: true,
      inline: true,
      join_vars: true,
      keep_fargs: true,
      keep_fnames: false,
      keep_infinity: false,
      loops: true,
      negate_iife: true,
      passes: 1,
      properties: true,
      pure_getters: 'strict',
      reduce_vars: true,
      sequences: true,
      side_effects: true,
      switches: true,
      top_retain: null,
      toplevel: false,
      typeofs: true,
      unsafe: false,
      unused: true,
    },
    output: {
      comments: false,
    },
  })
}

type MakeModule = {
  path: string
  sources: string[]
  source: string
}

type StatsChild = {
  path: string
  packageName: string
  sources: string[]
  children: StatsChild[]
}

type StatsTree = {
  packageName: string
  sources: string[]
  children: StatsChild[]
}

async function bundleSizeTree(stats: webpack.StatsCompilation) {
  // const stats = statsObj.toJson();
  let statsTree: StatsTree = {
    packageName: '<root>',
    sources: [],
    children: [],
  }

  if (!stats.compilation.modules) return []

  // extract source path for each module
  let modules: MakeModule[] = []
  const makeModule = (mod: webpack.Module): MakeModule => {
    // Uglifier cannot minify a json file, hence we need
    // to make it valid javascript syntax
    const isJSON = mod.identifier().endsWith('.json')
    const rawSource = mod
      .source(
        stats.compilation.dependencyTemplates,
        stats.compilation.runtimeTemplate
      )
      .source()
      .toString()
    const source = isJSON ? `$a$=${rawSource}` : rawSource

    return {
      path: modulePath(mod.identifier()),
      sources: [source || ''],
      source: source || '',
    }
  }

  for (const mod of stats.compilation.modules) {
    if (mod.nameForCondition()?.startsWith('external')) {
      continue
    }
    // if (mod.modules) {
    //   mod.modules.forEach(subMod => {
    //     modules.push(makeModule(subMod))
    //   })
    // } else {
    modules.push(makeModule(mod))
    // }
  }

  modules.sort((a, b) => {
    if (a === b) {
      return 0
    } else {
      return a < b ? -1 : 1
    }
  })

  modules.forEach(mod => {
    let packages = mod.path.split(
      new RegExp('\\' + path.sep + 'node_modules\\' + path.sep)
    )

    if (packages.length > 1) {
      let lastSegment = packages.pop()

      if (!lastSegment) return

      let lastPackageName
      if (lastSegment[0] === '@') {
        // package is a scoped package
        let offset = lastSegment.indexOf(path.sep) + 1
        lastPackageName = lastSegment.slice(
          0,
          offset + lastSegment.slice(offset).indexOf(path.sep)
        )
      } else {
        lastPackageName = lastSegment.slice(0, lastSegment.indexOf(path.sep))
      }
      packages.push(lastPackageName)
    }
    packages.shift()

    let parent = statsTree
    packages.forEach(pkg => {
      let existing = parent.children.filter(child => child.packageName === pkg)
      if (existing.length > 0) {
        existing[0].sources.push(mod.source)
        parent = existing[0]
      } else {
        let newChild = {
          path: mod.path,
          packageName: pkg,
          sources: [mod.source],
          children: [],
        }
        parent.children.push(newChild)
        parent = newChild
      }
    })
  })

  const resultPromises = statsTree.children
    .map(treeItem => ({
      ...treeItem,
      sources: treeItem.sources.filter(source => !!source),
    }))
    .filter(treeItem => treeItem.sources.length)
    .map(async treeItem => {
      const sourceMinifiedPromises = treeItem.sources.map(minifyDependencyCode)

      try {
        const sources = await Promise.all(sourceMinifiedPromises)
        const size = sources.reduce((acc, source) => {
          return acc + getByteLen(source.code || '')
        }, 0)

        return {
          name: treeItem.packageName,
          approximateSize: size,
        }
      } catch (error) {
        const { message, filename } = error
        throw new MinifyError(error, {
          message: message,
          filePath: filename,
        })
      }
    })

  return Promise.all(resultPromises)
}

export default bundleSizeTree
