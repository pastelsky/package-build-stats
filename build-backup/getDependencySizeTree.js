'use strict'
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k
  Object.defineProperty(o, k2, {
    enumerable: true, get: function() {
      return m[k]
    }
  })
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k
  o[k2] = m[k]
}))
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v })
}) : function(o, v) {
  o['default'] = v
})
var __importStar = (this && this.__importStar) || function(mod) {
  if (mod && mod.__esModule) return mod
  var result = {}
  if (mod != null) for (var k in mod) if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k)
  __setModuleDefault(result, mod)
  return result
}
var __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod }
}
Object.defineProperty(exports, '__esModule', { value: true })
exports.getDependencySizeTreeNext = void 0
const path_1 = __importDefault(require('path'))
const terser_1 = __importDefault(require('terser'))
const esbuild = __importStar(require('esbuild'))
const CustomError_1 = require('./errors/CustomError')
const telemetry_utils_1 = __importDefault(require('./utils/telemetry.utils'))
const perf_hooks_1 = require('perf_hooks')

/**
 * A fork of `webpack-bundle-size-analyzer`.
 * https://github.com/robertknight/webpack-bundle-size-analyzer
 */
function getDependencySizeTreeNext(packageName, bundleGraph) {
  const modules = []
  const bundles = bundleGraph.getBundles()
  bundles.forEach(bundle => {
    bundle.traverseAssets(asset => {
      const dependencies = asset.getDependencies()
      dependencies.forEach(({ specifier }) => {
        // modules.push({
        //   identifier: dep
        // })
        // console.log(
        //   'In asset : ',
        //   { filePath: asset.filePath },
        //   ' dependency: ',
        //   {
        //     specifier,
        //   }
        // )
      })
    })
  })
  // generateBuildMetrics({})
  // bundleSizeTree(packageName, {
  //   modules: {
  //
  //   }
  // })
}

exports.getDependencySizeTreeNext = getDependencySizeTreeNext

function modulePath(identifier) {
  // the format of module paths is
  //   '(<loader expression>!)?/path/to/module.js'
  let loaderRegex = /.*!/
  return identifier.replace(loaderRegex, '')
}

function getByteLen(normal_val) {
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

async function minifyDependencyCode(source, minifier = 'terser') {
  if (minifier === 'terser') {
    return terser_1.default.minify(source, {
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
        unused: true
      },
      output: {
        comments: false
      }
    })
  } else {
    return esbuild.transform(
      // ESBuild Minifier doesn't auto-remove license comments from code
      // So, we break ESBuild's heuristic for license comments match. See github.com/privatenumber/esbuild-loader/issues/87
      source
        .replace(/@license/g, '@silence')
        .replace(/\/\/!/g, '//')
        .replace(/\/\*!/g, '//'), { minify: true })
  }
}

async function bundleSizeTree(packageName, stats, minifier) {
  let startTime = perf_hooks_1.performance.now()
  let statsTree = {
    packageName: '<root>',
    sources: [],
    children: []
  }
  if (!stats.modules)
    return []
  // extract source path for each module
  let modules = []
  const makeModule = (mod) => {
    // Uglifier cannot minify a json file, hence we need
    // to make it valid javascript syntax
    const isJSON = mod.identifier.endsWith('.json')
    // const rawSource = mod
    //   .source(stats.dependencyTemplates, stats.runtimeTemplate)
    //   .source()
    //   .toString()
    const source = isJSON ? `$a$=${mod.source}` : mod.source
    return {
      path: modulePath(mod.identifier),
      sources: [source || ''],
      source: source || ''
    }
  };
  [...stats.modules]
    // TODO W5: check if name property works
    .filter(mod => {
      var _a
      return !((_a = mod.name) === null || _a === void 0 ? void 0 : _a.startsWith('external'))
    })
    .forEach(mod => {
      modules.push(makeModule(mod))
    })
  modules.sort((a, b) => {
    if (a === b) {
      return 0
    } else {
      return a < b ? -1 : 1
    }
  })
  modules.forEach(mod => {
    // pnpm will serve packages from a global symlink (.pnpm/package@verison/node_modules/package)
    // needs to be stripped off
    const pnpmPrefix = '.pnpm\\' + path_1.default.sep + '.+\\' + path_1.default.sep + 'node_modules\\' + path_1.default.sep
    let packages = mod.path.split(new RegExp('\\' + path_1.default.sep + 'node_modules\\' + path_1.default.sep + `(?:${pnpmPrefix})?`))
    if (packages.length > 1) {
      let lastSegment = packages.pop()
      if (!lastSegment)
        return
      let lastPackageName
      if (lastSegment[0] === '@') {
        // package is a scoped package
        let offset = lastSegment.indexOf(path_1.default.sep) + 1
        lastPackageName = lastSegment.slice(0, offset + lastSegment.slice(offset).indexOf(path_1.default.sep))
      } else {
        lastPackageName = lastSegment.slice(0, lastSegment.indexOf(path_1.default.sep))
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
          children: []
        }
        parent.children.push(newChild)
        parent = newChild
      }
    })
  })
  const resultPromises = statsTree.children
    .map(treeItem => (Object.assign(Object.assign({}, treeItem), { sources: treeItem.sources.filter(source => !!source) })))
    .filter(treeItem => treeItem.sources.length)
    .map(async (treeItem) => {
      const sourceMinifiedPromises = treeItem.sources.map(async (code) => {
        const start = Date.now()
        const minified = await minifyDependencyCode(code, minifier)
        return minified
      })
      try {
        const sources = await Promise.all(sourceMinifiedPromises)
        const size = sources.reduce((acc, source) => {
          return acc + getByteLen(source.code || '')
        }, 0)
        return {
          name: treeItem.packageName,
          approximateSize: size
        }
      } catch (error) {
        const { message, filename } = error
        throw new CustomError_1.MinifyError(error, {
          message: message,
          filePath: filename
        })
      }
    })
  try {
    const results = await Promise.all(resultPromises)
    telemetry_utils_1.default.dependencySizes(packageName, startTime, true, { minifier })
    return results
  } catch (e) {
    telemetry_utils_1.default.dependencySizes(packageName, startTime, false, { minifier }, e)
    throw e
  }
}

exports.default = bundleSizeTree
