import fs from 'node:fs/promises'
import path from 'node:path'
import escapeRegex from 'escape-string-regexp'
import type { InstallPackageOptions } from './common.types.js'
import { resolvePackageModule } from './config/packageResolution.js'
import { preparePackage } from './packageInstallation.js'
import { getPackageImportPath, throwIfAborted } from './utils/common.utils.js'

function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(exportTargets)
}

function runnableTarget(file: string) {
  return (
    /\.(?:[cm]?js|jsx|tsx?|css|sass|scss|less|svelte)$/.test(file) &&
    !/\.d\.[cm]?ts$/.test(file)
  )
}

/** Lists concrete public browser import paths, without compiling bundles. */
export async function getPackageEntryPoints(
  packageString: string,
  options: InstallPackageOptions = {},
): Promise<string[]> {
  const prepared = await preparePackage(packageString, options, false)
  try {
    const { packagePath, packageName } = prepared
    const manifest = JSON.parse(
      await fs.readFile(path.join(packagePath, 'package.json'), 'utf8'),
    )
    const exports: unknown = manifest.exports
    const subpaths =
      exports && typeof exports === 'object' && !Array.isArray(exports)
        ? Object.entries(exports).filter(([key]) => key.startsWith('.'))
        : []
    const declarations = subpaths.length ? subpaths : [['.', exports] as const]
    const candidates = new Set<string>()
    const hasPatterns = declarations.some(([key]) => key.includes('*'))
    const files = hasPatterns
      ? (await fs.readdir(packagePath, { recursive: true })).map(
          file => `./${file.split(path.sep).join('/')}`,
        )
      : []

    for (const [key, target] of declarations) {
      throwIfAborted(options.signal)
      if (!key.includes('*')) {
        candidates.add(key)
        continue
      }
      for (const pattern of exportTargets(target)) {
        if (!pattern.startsWith('./') || !pattern.includes('*')) continue
        const parts = pattern.split('*').map(escapeRegex)
        const matcher = new RegExp(
          `^${parts[0]}(.*)${parts.slice(1).join('\\1')}$`,
        )
        for (const file of files) {
          const match = matcher.exec(file)
          if (match) candidates.add(key.replace('*', match[1]))
        }
      }
    }

    return [...candidates]
      .filter(entryPoint => {
        throwIfAborted(options.signal)
        const request =
          exports === undefined && entryPoint === '.'
            ? './'
            : getPackageImportPath(packageName, entryPoint)
        const target = resolvePackageModule(packagePath, request)
        return typeof target === 'string' && runnableTarget(target)
      })
      .sort()
  } finally {
    await prepared.cleanup()
  }
}
