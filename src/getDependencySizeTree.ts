import path from 'path'
import { minify } from '@swc/core'
import { MinifyError } from './errors/CustomError'
import Telemetry from './utils/telemetry.utils'
import { performance } from 'perf_hooks'

function modulePath(identifier: string) {
  // the format of module paths is
  //   '(<loader expression>!)?/path/to/module.js'
  // OR
  // 'javascript/esm|/some/path'
  let loaderRegex = /.*!/
  const withoutLoader = identifier.replace(loaderRegex, '')
  if (withoutLoader.includes('|')) return withoutLoader.split('|')[1]
  return withoutLoader
}

function getUtf8Size(value: string) {
  const size = Buffer.byteLength(value, 'utf8')
  
  if (process.env.DEBUG_SIZE && Math.random() < 0.01) { // Only debug 1% to avoid spam  }
  
  return size
}

/**
 * Extract all package names from a module path to build a dependency chain.
 * For example: /node_modules/a/node_modules/b/index.js returns ['a', 'b']
 * This preserves the old behavior of showing nested dependencies.
 */
function extractPackageNamesFromPath(moduleFilePath: string): string[] {
  // pnpm will serve packages from a global symlink (.pnpm/package@version/node_modules/package)
  // needs to be stripped off
  const pnpmPrefix = '.pnpm\\' + path.sep + '.+\\' + path.sep + 'node_modules\\' + path.sep
  const packages = moduleFilePath.split(
    new RegExp('\\' + path.sep + 'node_modules\\' + path.sep + `(?:${pnpmPrefix})?`)
  )

  if (packages.length <= 1) return []

  const lastSegment = packages.pop()
  if (!lastSegment) return []

  // Extract the package name from the last segment
  let lastPackageName
  if (lastSegment[0] === '@') {
    // package is a scoped package
    const offset = lastSegment.indexOf(path.sep) + 1
    lastPackageName = lastSegment.slice(
      0,
      offset + lastSegment.slice(offset).indexOf(path.sep)
    )
  } else {
    lastPackageName = lastSegment.slice(0, lastSegment.indexOf(path.sep))
  }
  
  packages.push(lastPackageName)
  packages.shift() // Remove the first empty element
  
  return packages
}

async function minifyDependencyCode(source: string) {
  if (process.env.DEBUG_SIZE) {  }
  
  try {
    const startTime = Date.now()
    const result = await minify(source, {
      compress: true,
      mangle: true,
      module: true, // Treat as ES module to support import/export
    })
    const minifyTime = Date.now() - startTime
    
    if (process.env.DEBUG_SIZE) {    }
    
    return { code: result.code }
  } catch (error) {
    if (process.env.DEBUG_SIZE) {    }
    console.error('SWC minify error:', error)
    throw error
  }
}

type RspackStatsCompilation = NonNullable<
  ReturnType<NonNullable<import('@rspack/core').Stats['toJson']>>
>

type RspackModule = NonNullable<RspackStatsCompilation['modules']>[0]

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

function normaliseModuleSource(mod: RspackModule) {
  const identifier = mod.identifier || ''
  const isJSON = identifier.endsWith('.json')
  const rawSource = mod.source

  if (process.env.DEBUG_SIZE) {  }

  if (rawSource === undefined || rawSource === null) {
    if (process.env.DEBUG_SIZE) {    }
    return null
  }

  let source: string

  if (typeof rawSource === 'string') {
    source = rawSource
    if (process.env.DEBUG_SIZE) {    }
  } else if (Buffer.isBuffer(rawSource)) {
    source = rawSource.toString('utf8')
    if (process.env.DEBUG_SIZE) {    }
  } else {
    source = String(rawSource)
    if (process.env.DEBUG_SIZE) {    }
  }

  const finalSource = isJSON ? `$a$=${source}` : source
  if (process.env.DEBUG_SIZE) {  }
  
  return finalSource
}

async function bundleSizeTree(
  packageName: string,
  stats: RspackStatsCompilation,
) {
  const startTime = performance.now()
  const statsTree: StatsTree = {
    packageName: '<root>',
    sources: [],
    children: [],
  }

  if (!stats.modules) return []

  // Collect modules with their sources
  const modules: Array<{ path: string; source: string }> = []
  
  const makeModule = (mod: RspackModule): { path: string; source: string } | null => {
    const identifier = mod.identifier || ''
    const resolvedPath = modulePath(identifier)
    const source = normaliseModuleSource(mod)
    
    if (!source) return null
    
    return {
      path: resolvedPath,
      source,
    }
  }

  const filteredModules = stats.modules
    .filter(mod => !(mod.name?.startsWith('external') || mod.moduleType === 'runtime'))
  
  if (process.env.DEBUG_SIZE) {
    console.log(`\n[LOCAL] ==================== ${packageName} ====================`)
  }

  filteredModules.forEach(mod => {
      if (mod.modules) {
        if (process.env.DEBUG_SIZE) {        }
        mod.modules.forEach(subMod => {
          const made = makeModule(subMod)
          if (made) modules.push(made)
        })
      } else {
        const made = makeModule(mod)
        if (made) modules.push(made)
      }
    })

  if (process.env.DEBUG_SIZE) {  }

  modules.sort((a, b) => {
    if (a === b) {
      return 0
    } else {
      return a < b ? -1 : 1
    }
  })

  // Build tree structure from module paths
  modules.forEach((mod, modIndex) => {
    const packages = extractPackageNamesFromPath(mod.path)
    
    if (process.env.DEBUG_SIZE && modIndex < 5) {    }
    
    if (packages.length === 0) {
      if (process.env.DEBUG_SIZE && modIndex < 5) {      }
      return
    }

    let parent = statsTree
    packages.forEach((pkg, pkgIndex) => {
      const existing = parent.children.filter(child => child.packageName === pkg)
      if (existing.length > 0) {
        existing[0].sources.push(mod.source)
        if (process.env.DEBUG_SIZE && modIndex < 5) {        }
        parent = existing[0]
      } else {
        const newChild: StatsChild = {
          path: mod.path,
          packageName: pkg,
          sources: [mod.source],
          children: [],
        }
        parent.children.push(newChild)
        if (process.env.DEBUG_SIZE && modIndex < 5) {        }
        parent = newChild
      }
    })
  })

  // The old webpack implementation returned only the first-level children
  // We need to preserve that behavior
  const flattenedItems = statsTree.children

  if (process.env.DEBUG_SIZE) {
    console.log(`\n[LOCAL] Tree structure built with ${flattenedItems.length} top-level dependencies:`)
  }

  const resultPromises = flattenedItems
    .map(treeItem => ({
      ...treeItem,
      sources: treeItem.sources.filter(source => !!source),
    }))
    .filter(treeItem => treeItem.sources.length)
    .map(async (treeItem) => {
      if (process.env.DEBUG_SIZE) {
        console.log(`\n[LOCAL] Processing dependency: ${treeItem.packageName}`)
      }

      const sourceMinifiedPromises = treeItem.sources.map(async (code: string, idx) => {
        const originalSize = getUtf8Size(code)
        
        if (process.env.DEBUG_SIZE) {        }
        
        const minified = await minifyDependencyCode(code)
        const minifiedSize = getUtf8Size(minified.code || '')
        const minifiedCode = minified.code || ''
        
        if (process.env.DEBUG_SIZE) {        }
        
        return minified
      })

      try {
        const sources = await Promise.all(sourceMinifiedPromises)
        const size = sources.reduce((acc: number, source, idx) => {
          const sourceSize = getUtf8Size(source.code || '')
          if (process.env.DEBUG_SIZE) {          }
          return acc + sourceSize
        }, 0)

        if (process.env.DEBUG_SIZE) {        }

        return {
          name: treeItem.packageName,
          approximateSize: size,
        }
      } catch (error: any) {
        const { message, filename } = error
        throw new MinifyError(error, {
          message: message,
          filePath: filename,
        })
      }
    })

  try {
    const results = await Promise.all(resultPromises)
    Telemetry.dependencySizes(packageName, startTime, true, { minifier: 'swc' })
    return results
  } catch (e) {
    Telemetry.dependencySizes(
      packageName,
      startTime,
      false,
      { minifier: 'swc' },
      e,
    )
    throw e
  }
}

export default bundleSizeTree
