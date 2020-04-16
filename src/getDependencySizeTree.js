const path = require('path')
const Terser = require('terser')
const CustomError = require('./CustomError')

/**
 * A fork of `webpack-bundle-size-analyzer`.
 * https://github.com/robertknight/webpack-bundle-size-analyzer
 */

function modulePath(identifier) {
  // the format of module paths is
  //   '(<loader expression>!)?/path/to/module.js'
  let loaderRegex = /.*!/
  return identifier.replace(loaderRegex, '')
}

function getByteLen(normal_val) {
  // Force string type
  normal_val = String(normal_val)

  var byteLen = 0
  for (var i = 0; i < normal_val.length; i++) {
    var c = normal_val.charCodeAt(i)
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

function bundleSizeTree(stats) {
  let statsTree = {
    packageName: '<root>',
    sources: [],
    children: [],
  }

  if (stats.name) {
    statsTree.bundleName = stats.name
  }

  if (!stats.modules) return []

  // extract source path for each module
  let modules = []
  const makeModule = mod => {
    // Uglifier cannot minify a json file, hence we need
    // to make it valid javascript syntax
    const isJSON = mod.identifier.endsWith('.json')
    const source = isJSON ? `$a$=${mod.source}` : mod.source

    return {
      path: modulePath(mod.identifier),
      sources: [source],
      source: source,
    }
  }

  stats.modules
    .filter(mod => !mod.name.startsWith('external'))
    .forEach(mod => {
      if (mod.modules) {
        mod.modules.forEach(subMod => {
          modules.push(makeModule(subMod))
        })
      } else {
        modules.push(makeModule(mod))
      }
    })

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
      let lastPackageName = ''
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
    parent.sources.push(mod.source)
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

  const results = statsTree.children
    .map(treeItem => ({
      ...treeItem,
      sources: treeItem.sources.filter(source => !!source),
    }))
    .filter(treeItem => treeItem.sources.length)
    .map(treeItem => {
      const size = treeItem.sources.reduce((acc, source) => {
        const uglifiedSource = Terser.minify(source, {
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
            pure_funcs: null,
            reduce_vars: true,
            sequences: true,
            side_effects: true,
            switches: true,
            top_retain: null,
            toplevel: false,
            typeofs: true,
            unsafe: false,
            unused: true,
            warnings: false,
          },
          output: {
            comments: false,
          },
        })

        if (uglifiedSource.error) {
          const filePath = treeItem.path.match(/.+node_modules\/(.+)/)[1]
          throw new CustomError('MinifyError', uglifiedSource.error, {
            name: uglifiedSource.error.name,
            message: uglifiedSource.error.message,
            filePath,
          })
        }

        return acc + getByteLen(uglifiedSource.code)
      }, 0)

      return {
        name: treeItem.packageName,
        approximateSize: size,
      }
    })

  return results
}

module.exports = bundleSizeTree
