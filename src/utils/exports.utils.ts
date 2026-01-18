/**
 * Export scanning using oxc-parser and oxc-resolver
 *
 * This implementation follows the pattern from oxc-linter's export.rs
 * using the public npm packages oxc-parser and oxc-resolver.
 */

import { parseSync, StaticExport, StaticExportEntry } from 'oxc-parser'
import { ResolverFactory } from 'oxc-resolver'
import path from 'path'
import fs from 'fs/promises'
import Telemetry from './telemetry.utils.js'
import { performance } from 'perf_hooks'

// Initialize resolver with ESM-first configuration
// - main_fields: ["module", "main"] - prioritize ESM entry points
// - condition_names: ["import", "default", "require"] - ESM-first export conditions
//   NOTE: We intentionally exclude "node" because Node.js conditional exports resolution
//   uses the PACKAGE's exports field order (not our conditionNames order) to determine
//   priority. Packages like Vue have "node" before "import" in their exports, so including
//   "node" would resolve to CJS files instead of ESM. We keep "require" as a fallback for
//   packages that only export via "require" condition.
// - extensions: all common JS/TS extensions
// - symlinks: false - keep paths as-is without resolving symlinks (matches enhanced-resolve behavior)
const resolver = new ResolverFactory({
  extensions: [
    '.mjs',
    '.js',
    '.mts',
    '.ts',
    '.jsx',
    '.tsx',
    '.cjs',
    '.cts',
    '.json',
  ],
  mainFields: ['module', 'main'], // ESM-first: prioritize "module" field over "main"
  conditionNames: ['import', 'default', 'require'], // ESM-first: exclude "node" which resolves to CJS
  symlinks: false, // Don't resolve symlinks to match enhanced-resolve behavior
})

/**
 * Represents a named export with its optional source module
 */
type NamedExport = {
  name: string
  moduleRequest?: string // The source module for re-exports like `export { foo } from './module.js'`
}

/**
 * Extract export information from parsed oxc module
 */
function getExportsFromStaticExports(staticExports: StaticExport[]): {
  exports: NamedExport[]
  exportAllLocations: string[]
} {
  const exports: NamedExport[] = []
  const exportAllLocations: string[] = []

  staticExports.forEach(staticExport => {
    staticExport.entries.forEach((entry: StaticExportEntry) => {
      // Skip type-only exports (TypeScript type exports)
      if (entry.isType) {
        return
      }

      // Handle different export types based on importName kind
      switch (entry.importName.kind) {
        case 'AllButDefault': // export * from "mod"
        case 'All': // export * as ns from "mod"
          if (entry.moduleRequest) {
            exportAllLocations.push(entry.moduleRequest.value)
          }
          break

        case 'Name': // export { foo } or export { foo } from "mod"
        case 'None': // export const foo = 1
          // Get the export name
          if (entry.exportName.kind === 'Name' && entry.exportName.name) {
            exports.push({
              name: entry.exportName.name,
              moduleRequest: entry.moduleRequest?.value, // Track the source module for re-exports
            })
          } else if (entry.exportName.kind === 'Default') {
            exports.push({
              name: 'default',
              moduleRequest: entry.moduleRequest?.value,
            })
          }
          break
      }
    })
  })

  return { exports, exportAllLocations }
}

/**
 * Resolve a module path from a given context
 */
async function resolveModule(
  context: string,
  lookupPath: string,
): Promise<string> {
  const result = resolver.sync(context, lookupPath)
  if (!result.path) {
    throw new Error(`Cannot resolve module '${lookupPath}' from '${context}'`)
  }
  return result.path
}

type ResolvedExports = {
  [key: string]: string
}

/**
 * Recursively walk exports following export * statements
 *
 * This mirrors the walk_exported_recursive function in export.rs
 */
async function walkExportsRecursive(
  context: string,
  lookupPath: string,
  visited: Set<string>,
  rootContext?: string,
  _isRootCall: boolean = false,
): Promise<ResolvedExports> {
  // Use rootContext for calculating relative paths, context for resolution
  const root = rootContext || context
  const resolvedPath = await resolveModule(context, lookupPath)

  // Avoid circular dependencies
  if (visited.has(resolvedPath)) {
    return {}
  }
  visited.add(resolvedPath)

  // Parse the file to get exports
  const code = await fs.readFile(resolvedPath, 'utf8')
  const parseResult = parseSync(resolvedPath, code, {
    sourceType: 'module',
  })

  // Check if file has module syntax
  if (!parseResult.module.hasModuleSyntax) {
    return {}
  }

  const { exports, exportAllLocations } = getExportsFromStaticExports(
    parseResult.module.staticExports,
  )

  const resolvedExports: ResolvedExports = {}

  // Add direct exports from this module, resolving re-exports to their source files
  for (const exp of exports) {
    let sourcePath = resolvedPath

    // If this is a re-export (export { foo } from './module.js'), resolve to the source file
    if (exp.moduleRequest) {
      try {
        sourcePath = await resolveModule(
          path.dirname(resolvedPath),
          exp.moduleRequest,
        )
      } catch {
        // If resolution fails, fall back to current file
        sourcePath = resolvedPath
      }
    }

    // Use path.relative() to calculate the relative path from root to sourcePath
    // This works correctly since symlinks are not resolved (symlinks: false in resolver config)
    const relativePath = root
      ? path.relative(root, sourcePath)
      : path.basename(sourcePath)

    resolvedExports[exp.name] = relativePath
  }

  // Recursively process export * statements
  const promises = exportAllLocations.map(async location => {
    const starExports = await walkExportsRecursive(
      path.dirname(resolvedPath),
      location,
      visited,
      root, // Pass root context through recursion
    )
    // Merge star exports into our exports
    Object.keys(starExports).forEach(expKey => {
      resolvedExports[expKey] = starExports[expKey]
    })
  })

  await Promise.all(promises)
  return resolvedExports
}

/**
 * Get all exports from a package
 *
 * This is the main entry point that matches the API of getAllExports in exports.utils.ts
 */
export async function getAllExports(
  packageString: string,
  context: string,
  lookupPath: string,
  installPath?: string, // Base path for calculating relative paths (optional)
) {
  const startTime = performance.now()
  const visited = new Set<string>()

  try {
    // Read package.json to get the entry point
    const packageJsonPath = path.join(context, 'package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    // Prefer module field for ESM, fallback to main, then default
    let entryPoint = packageJson.module || packageJson.main || './index.js'

    // Normalize entry point to start with ./
    if (!entryPoint.startsWith('./') && !entryPoint.startsWith('../')) {
      entryPoint = './' + entryPoint
    }

    // Resolve the entry point relative to context
    // Pass installPath as rootContext for calculating relative paths
    const results = await walkExportsRecursive(
      context,
      entryPoint,
      visited,
      installPath,
      true,
    )
    Telemetry.walkPackageExportsTree(packageString, startTime, true)
    return results
  } catch (err) {
    Telemetry.walkPackageExportsTree(packageString, startTime, false, err)
    throw err
  }
}

/**
 * Get exports details from code (compatibility function)
 *
 * This provides the same API as the existing getExportsDetails for backward compatibility
 * Returns simple string arrays for exports (without moduleRequest info)
 */
export function getExportsDetails(code: string, filename = 'module.js') {
  const parseResult = parseSync(filename, code, {
    sourceType: 'module',
  })

  const result = getExportsFromStaticExports(parseResult.module.staticExports)

  // Return simple string array for backward compatibility
  return {
    exports: result.exports.map(exp => exp.name),
    exportAllLocations: result.exportAllLocations,
  }
}
