import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { throwIfAborted } from './common.utils.js'

type PackageJSON = {
  exports?: unknown
}

const ACTIVE_IMPORT_CONDITIONS = new Set([
  'browser',
  'default',
  'import',
  'module',
  'production',
  'svelte',
  'webpack',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getImportTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap(getImportTargets)
  }

  if (!isRecord(value)) {
    return []
  }

  for (const [condition, target] of Object.entries(value)) {
    if (!ACTIVE_IMPORT_CONDITIONS.has(condition)) {
      continue
    }

    const targets = getImportTargets(target)
    if (targets.length) {
      return targets
    }
  }

  return []
}

function isBundlableTarget(target: string) {
  return (
    target.startsWith('./') &&
    !target.endsWith('.d.ts') &&
    !target.endsWith('.d.mts') &&
    !target.endsWith('.d.cts') &&
    !target.endsWith('.json')
  )
}

function toImportPoint(packageName: string, subpath: string) {
  return subpath === '.'
    ? packageName
    : `${packageName}/${subpath.replace(/^\.\//, '')}`
}

function matchesSubpathPattern(subpath: string, pattern: string) {
  const wildcardIndex = pattern.indexOf('*')
  if (wildcardIndex === -1) {
    return subpath === pattern
  }

  const prefix = pattern.slice(0, wildcardIndex)
  const suffix = pattern.slice(wildcardIndex + 1)
  return (
    subpath.startsWith(prefix) &&
    subpath.endsWith(suffix) &&
    subpath.length >= prefix.length + suffix.length
  )
}

function selectedExportKey(subpath: string, exportKeys: string[]) {
  if (exportKeys.includes(subpath)) {
    return subpath
  }

  return exportKeys
    .filter(key => key.includes('*') && matchesSubpathPattern(subpath, key))
    .sort((left, right) => {
      const prefixDifference = right.indexOf('*') - left.indexOf('*')
      return prefixDifference || right.length - left.length
    })[0]
}

function toSubpath(packageName: string, importPoint: string) {
  return importPoint === packageName
    ? '.'
    : `./${importPoint.slice(packageName.length + 1)}`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function makeTargetPatternRegex(targetPattern: string) {
  const parts = targetPattern.split('*')
  let source = `^${escapeRegex(parts[0])}`

  if (parts.length > 1) {
    source += `(.+?)${escapeRegex(parts[1])}`
    for (const part of parts.slice(2)) {
      source += `\\1${escapeRegex(part)}`
    }
  }

  return new RegExp(`${source}$`)
}

async function collectFiles(
  directory: string,
  packagePath: string,
  signal?: AbortSignal,
): Promise<string[]> {
  throwIfAborted(signal)

  let entries: Dirent[]
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const files = await Promise.all(
    entries.map(async entry => {
      throwIfAborted(signal)
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return collectFiles(entryPath, packagePath, signal)
      }

      return entry.isFile()
        ? [path.relative(packagePath, entryPath).split(path.sep).join('/')]
        : []
    }),
  )

  return files.flat()
}

async function targetExists(packagePath: string, target: string) {
  const packageRoot = path.resolve(packagePath)
  const targetPath = path.resolve(packagePath, target)
  if (
    targetPath !== packageRoot &&
    !targetPath.startsWith(`${packageRoot}${path.sep}`)
  ) {
    return false
  }

  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function expandPatternImportPoints(
  packageName: string,
  packagePath: string,
  subpathPattern: string,
  targetPattern: string,
  signal?: AbortSignal,
) {
  if (
    !subpathPattern.includes('*') ||
    !targetPattern.includes('*') ||
    !isBundlableTarget(targetPattern)
  ) {
    return []
  }

  const relativeTargetPattern = targetPattern.slice(2)
  const staticPrefix = relativeTargetPattern.slice(
    0,
    relativeTargetPattern.indexOf('*'),
  )
  const scanDirectory = path.resolve(
    packagePath,
    path.posix.dirname(`${staticPrefix}__candidate__`),
  )
  const packageRoot = path.resolve(packagePath)

  if (
    scanDirectory !== packageRoot &&
    !scanDirectory.startsWith(`${packageRoot}${path.sep}`)
  ) {
    return []
  }

  const matcher = makeTargetPatternRegex(relativeTargetPattern)
  const files = await collectFiles(scanDirectory, packageRoot, signal)

  return files.flatMap(file => {
    if (!isBundlableTarget(`./${file}`)) {
      return []
    }

    const match = file.match(matcher)
    if (!match?.[1]) {
      return []
    }

    return [
      toImportPoint(packageName, subpathPattern.replaceAll('*', match[1])),
    ]
  })
}

async function getSubpathImportPoints(
  packageName: string,
  packagePath: string,
  subpath: string,
  exportValue: unknown,
  signal?: AbortSignal,
) {
  const targets = getImportTargets(exportValue)

  const resolvedTargets = await Promise.all(
    targets.map(async target => {
      throwIfAborted(signal)

      if (subpath.includes('*')) {
        return expandPatternImportPoints(
          packageName,
          packagePath,
          subpath,
          target,
          signal,
        )
      }

      return isBundlableTarget(target) &&
        (await targetExists(packagePath, target))
        ? [toImportPoint(packageName, subpath)]
        : []
    }),
  )

  return resolvedTargets.find(importPoints => importPoints.length) ?? []
}

export async function getImportPointsFromPackage(
  packageName: string,
  packagePath: string,
  signal?: AbortSignal,
) {
  throwIfAborted(signal)
  const packageJson = JSON.parse(
    await fs.readFile(path.join(packagePath, 'package.json'), 'utf8'),
  ) as PackageJSON
  throwIfAborted(signal)

  if (packageJson.exports === undefined) {
    return [packageName]
  }

  const exportsField = packageJson.exports
  const subpathEntries = isRecord(exportsField)
    ? Object.entries(exportsField).filter(([key]) => key.startsWith('.'))
    : []

  const entries: Array<[string, unknown]> = subpathEntries.length
    ? subpathEntries
    : [['.', exportsField]]

  const exportKeys = entries.map(([subpath]) => subpath)
  const resolvedEntries = await Promise.all(
    entries.map(async ([subpath, exportValue]) => {
      if (subpath !== '.' && !subpath.startsWith('./')) {
        return { importPoints: [], subpath }
      }

      return {
        importPoints: await getSubpathImportPoints(
          packageName,
          packagePath,
          subpath,
          exportValue,
          signal,
        ),
        subpath,
      }
    }),
  )
  const importPoints = new Set(
    resolvedEntries.flatMap(({ importPoints: candidates, subpath }) =>
      candidates.filter(
        importPoint =>
          selectedExportKey(toSubpath(packageName, importPoint), exportKeys) ===
          subpath,
      ),
    ),
  )

  return [...importPoints].sort((left, right) => {
    if (left === packageName) return -1
    if (right === packageName) return 1
    return left.localeCompare(right)
  })
}
