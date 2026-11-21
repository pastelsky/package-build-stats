import { checkPlatform } from 'npm-install-checks'
import { exports as resolveExports } from 'resolve.exports'
import type { Exports as ResolveExportsField } from 'resolve.exports'
import { browserImportConditions } from './config/packageConditions.js'
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
  libc?: readonly string[]
  bin?: string | Record<string, string>
  exports?: unknown
}

export interface PreflightOptions {
  platform?: string
  arch?: string
  libc?: string | null
  entryPoint?: string
}

// Conservative preflight conditions: all bundler conditions plus CJS `require`
// so preflight never rejects a package that could resolve through CJS fallback.
const preflightExportConditions = [...browserImportConditions, 'require']

const declarationFilePattern = /\.d\.[cm]?ts$/i

function hasBinField(bin: PackageManifestPreflightInput['bin']): boolean {
  if (typeof bin === 'string') return bin.trim().length > 0
  if (typeof bin === 'object' && bin !== null && !Array.isArray(bin)) {
    return Object.keys(bin).length > 0
  }
  return false
}

function screenPlatform(
  manifest: PackageManifestPreflightInput,
  options: PreflightOptions,
): void {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch

  try {
    checkPlatform(
      {
        _id: manifest.version
          ? `${manifest.name}@${manifest.version}`
          : manifest.name,
        os: manifest.os,
        cpu: manifest.cpu,
        libc: manifest.libc,
      },
      false,
      {
        os: platform,
        cpu: arch,
        ...(options.libc !== undefined ? { libc: options.libc } : {}),
      },
    )
  } catch (error) {
    throw new UnsupportedPackageError(error, {
      reason: `This package does not support our build server (${platform}/${arch}).`,
    })
  }
}

function screenExports(
  manifest: PackageManifestPreflightInput,
  entryPoint: string,
): void {
  if (manifest.exports === undefined) return

  if (manifest.exports === null) {
    throw new EntryPointError(
      `Package "${manifest.name}" package.json "exports" is null.`,
    )
  }

  let resolved: readonly string[] | void
  try {
    resolved = resolveExports(
      {
        name: manifest.name,
        exports: manifest.exports as ResolveExportsField,
      },
      entryPoint,
      {
        unsafe: true,
        conditions: preflightExportConditions,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (entryPoint === '.' && hasBinField(manifest.bin)) {
      throw new CLIBuildError(message, { bin: manifest.bin })
    }
    throw new EntryPointError(message)
  }

  if (
    Array.isArray(resolved) &&
    resolved.length > 0 &&
    resolved.every(target => declarationFilePattern.test(target))
  ) {
    throw new EntryPointError(
      `Package "${manifest.name}" export "${entryPoint}" resolves only to TypeScript declarations.`,
    )
  }
}

/**
 * Lightweight, in-memory manifest preflight check backed by `npm-install-checks`
 * and `resolve.exports`.
 *
 * Rejects releases guaranteed to fail installation or entry-point resolution
 * under standard npm (`os`/`cpu`/`libc`) and Node Package Exports rules before
 * installing packages or loading bundler toolchains.
 */
export function screenPackageManifest(
  manifest: PackageManifestPreflightInput,
  options: PreflightOptions = {},
): void {
  const entryPoint = options.entryPoint ?? '.'

  screenPlatform(manifest, options)
  screenExports(manifest, entryPoint)
}
