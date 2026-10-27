/**
 * Export scanning using oxc-parser and oxc-resolver
 *
 * This implementation follows the pattern from oxc-linter's export.rs
 * using the public npm packages oxc-parser and oxc-resolver.
 */

import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import type { StaticExport, StaticExportEntry } from 'oxc-parser'
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import Telemetry from './telemetry.utils.js'
import { getPackageImportPath, throwIfAborted } from './common.utils.js'
import { resolvePackageModule } from '../config/packageResolution.js'

/** Confirm valid JSX, not HTML in a comment/string or another unsupported syntax. */
export function parseJsx(filename: string, source: string) {
  const result = parseSync(filename, source, {
    lang: 'jsx',
    sourceType: 'unambiguous',
  })
  if (result.errors.length) return
  let hasJsx = false
  walk(result.program, {
    enter(node) {
      if (node.type === 'JSXElement' || node.type === 'JSXFragment')
        hasJsx = true
    },
  })
  return hasJsx ? result : undefined
}

function parseModule(filename: string, source: string) {
  const result = parseSync(filename, source, { sourceType: 'module' })
  if (result.errors.length && filename.endsWith('.js')) {
    return parseJsx(filename, source) ?? result
  }
  return result
}

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
          if (entry.moduleRequest) {
            exportAllLocations.push(entry.moduleRequest.value)
          }
          break

        case 'All': // export * as ns from "mod"
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
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal)
  const resolvedPath = resolvePackageModule(context, lookupPath)
  if (!resolvedPath) {
    throw new Error(`Cannot resolve module '${lookupPath}' from '${context}'`)
  }
  return resolvedPath
}

type ResolvedExports = {
  [key: string]: string
}

/**
 * Parse each reachable module once, then find each export's source with its own
 * cycle guard. Shared/cyclic star graphs must not multiply filesystem work.
 */
async function walkExports(
  context: string,
  lookupPath: string,
  rootContext: string,
  signal?: AbortSignal,
): Promise<ResolvedExports> {
  type ModuleExports = {
    named: Map<string, NamedExport>
    stars: string[]
  }
  const modules = new Map<string, ModuleExports>()
  async function readModule(modulePath: string): Promise<ModuleExports> {
    throwIfAborted(signal)
    const cached = modules.get(modulePath)
    if (cached) return cached
    const code = await fs.readFile(modulePath, 'utf8')
    throwIfAborted(signal)
    const { module } = parseModule(modulePath, code)
    const details = getExportsFromStaticExports(module.staticExports)
    const result = {
      named: new Map(details.exports.map(exp => [exp.name, exp])),
      stars: await Promise.all(
        details.exportAllLocations.map(location =>
          resolveModule(path.dirname(modulePath), location, signal),
        ),
      ),
    }
    modules.set(modulePath, result)
    return result
  }

  const root = await resolveModule(context, lookupPath, signal)
  const names = new Set<string>()
  const collected = new Set<string>()
  async function collectNames(modulePath: string): Promise<void> {
    if (collected.has(modulePath)) return
    collected.add(modulePath)
    const module = await readModule(modulePath)
    for (const name of module.named.keys()) {
      if (name !== 'default' || modulePath === root) names.add(name)
    }
    for (const source of module.stars) {
      // oxlint-disable-next-line no-await-in-loop
      await collectNames(source)
    }
  }

  async function findSource(
    modulePath: string,
    name: string,
    seen: Set<string>,
  ): Promise<string | undefined> {
    if (seen.has(modulePath)) return
    seen.add(modulePath)
    const module = await readModule(modulePath)
    const exp = module.named.get(name)
    if (exp) {
      if (!exp.moduleRequest) return modulePath
      try {
        return await resolveModule(
          path.dirname(modulePath),
          exp.moduleRequest,
          signal,
        )
      } catch {
        throwIfAborted(signal)
        return modulePath
      }
    }
    if (name === 'default') return
    for (const source of module.stars) {
      // Search each module at most once for this name, including in cycles.
      // oxlint-disable-next-line no-await-in-loop
      const candidate = await findSource(source, name, seen)
      if (candidate) return candidate
    }
  }

  await collectNames(root)
  const result: ResolvedExports = Object.create(null)
  for (const name of names) {
    // oxlint-disable-next-line no-await-in-loop
    const source = await findSource(root, name, new Set())
    if (source) {
      result[name] = path.relative(rootContext, source)
    }
  }
  return result
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
  signal?: AbortSignal,
  entryPoint = '.',
) {
  const startTime = performance.now()

  try {
    throwIfAborted(signal)
    // Read package.json to get the entry point
    const packageJsonPath = path.join(context, 'package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    throwIfAborted(signal)
    const importPath = getPackageImportPath(lookupPath, entryPoint)
    // Public exports must be resolved as a package request, not a file path.
    // Self-reference works for local fixtures too, without installing them.
    const request =
      packageJson.exports !== undefined || entryPoint !== '.'
        ? importPath
        : './'

    // Resolve the entry point relative to context
    // Pass installPath as rootContext for calculating relative paths
    const results = await walkExports(
      context,
      request,
      installPath ?? context,
      signal,
    )
    Telemetry.walkPackageExportsTree(packageString, startTime, true)
    return { ...results }
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
  const parseResult = parseModule(filename, code)

  const result = getExportsFromStaticExports(parseResult.module.staticExports)

  // Return simple string array for backward compatibility
  return {
    exports: result.exports.map(exp => exp.name),
    exportAllLocations: result.exportAllLocations,
  }
}
