import {
  CLIBuildError,
  EntryPointError,
  UnsupportedPackageError,
} from './errors/CustomError.js'

export { CLIBuildError, EntryPointError, UnsupportedPackageError }

export interface PackageManifestPreflightInput {
  name: string
  version?: string
  os?: readonly string[]
  cpu?: readonly string[]
  bin?: string | Record<string, string>
  exports?: unknown
}

export interface PreflightOptions {
  platform?: string
  arch?: string
  entryPoint?: string
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Evaluates npm's standard `os` / `cpu` constraint array against a target value.
 * Positive entries form an allowlist; `!value` entries form a blocklist.
 */
function matchesPlatformConstraint(
  constraints: readonly string[] | undefined,
  current: string,
): boolean {
  if (!Array.isArray(constraints) || constraints.length === 0) return true

  const valid = constraints.filter(
    entry => typeof entry === 'string' && entry.length > 0,
  )
  if (valid.length === 0) return true

  const blocked = valid
    .filter(entry => entry.startsWith('!'))
    .map(entry => entry.slice(1))

  if (blocked.includes(current)) return false

  const allowed = valid.filter(entry => !entry.startsWith('!'))

  return allowed.length === 0 || allowed.includes(current)
}

function hasBinField(bin: PackageManifestPreflightInput['bin']): boolean {
  if (typeof bin === 'string') return bin.trim().length > 0
  if (isPlainRecord(bin)) return Object.keys(bin).length > 0
  return false
}

function isTypesOnlyExportTarget(target: unknown): boolean {
  if (!isPlainRecord(target)) return false

  const keys = Object.keys(target)
  if (keys.length === 0) return false

  return keys.every(key => key === 'types' || key === 'typings')
}

function screenPlatform(
  manifest: PackageManifestPreflightInput,
  platform: string,
  arch: string,
): void {
  if (
    matchesPlatformConstraint(manifest.os, platform) &&
    matchesPlatformConstraint(manifest.cpu, arch)
  ) {
    return
  }

  throw new UnsupportedPackageError(
    { os: manifest.os, cpu: manifest.cpu },
    {
      reason: `This package does not support our build server (${platform}/${arch}).`,
    },
  )
}

function screenSubpathExports(
  manifest: PackageManifestPreflightInput,
  exportsMap: Record<string, unknown>,
  entryPoint: string,
): void {
  if (entryPoint === '.') {
    if (!Object.hasOwn(exportsMap, '.')) {
      if (hasBinField(manifest.bin)) {
        throw new CLIBuildError(
          `Package "${manifest.name}" does not export a root "." entry point.`,
          { bin: manifest.bin },
        )
      }

      throw new EntryPointError(
        `Package "${manifest.name}" does not export a root "." entry point in package.json "exports".`,
      )
    }

    const rootTarget = exportsMap['.']
    if (rootTarget === null || isTypesOnlyExportTarget(rootTarget)) {
      throw new EntryPointError(
        `Package "${manifest.name}" root "." export does not expose a runtime entry point.`,
      )
    }

    return
  }

  if (Object.hasOwn(exportsMap, entryPoint)) {
    const subpathTarget = exportsMap[entryPoint]
    if (subpathTarget === null || isTypesOnlyExportTarget(subpathTarget)) {
      throw new EntryPointError(
        `Package "${manifest.name}" export "${entryPoint}" does not expose a runtime entry point.`,
      )
    }
  }
}

function screenExports(
  manifest: PackageManifestPreflightInput,
  entryPoint: string,
): void {
  const { exports: pkgExports } = manifest

  if (pkgExports === null) {
    throw new EntryPointError(
      `Package "${manifest.name}" package.json "exports" is null.`,
    )
  }

  if (!isPlainRecord(pkgExports)) return

  const keys = Object.keys(pkgExports)
  if (keys.length === 0) return

  if (keys.every(key => key.startsWith('.'))) {
    screenSubpathExports(manifest, pkgExports, entryPoint)
    return
  }

  if (entryPoint === '.' && isTypesOnlyExportTarget(pkgExports)) {
    throw new EntryPointError(
      `Package "${manifest.name}" package.json "exports" only provides TypeScript types.`,
    )
  }
}

/**
 * Lightweight, zero-heavy-dependency manifest preflight check.
 *
 * Rejects releases guaranteed to fail installation or entry-point resolution
 * under standard npm (`os`/`cpu`) and Node Package Exports rules before
 * installing packages or loading bundler toolchains.
 */
export function screenPackageManifest(
  manifest: PackageManifestPreflightInput,
  options: PreflightOptions = {},
): void {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const entryPoint = options.entryPoint ?? '.'

  screenPlatform(manifest, platform, arch)
  screenExports(manifest, entryPoint)
}
