import path from 'node:path'
import type {
  InstallationServiceOptions,
  InstallPackageOptions,
} from './common.types.js'
import {
  BuildCancelledError,
  InstallError,
  PackageNotFoundError,
} from './errors/CustomError.js'
import { parsePackageString, throwIfAborted } from './utils/common.utils.js'
import InstallationUtils from './utils/installation.utils.js'

export interface PackageInstallation {
  packageString: string
  packageName: string
  installPath: string
  packagePath: string
}

export type PreparedPackage = PackageInstallation & {
  buildPath: string
  cleanup(retainLocalFiles?: boolean): Promise<void>
}

class InstallationServiceUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Installation service is unavailable', { cause })
  }
}

function serviceUrl(service: InstallationServiceOptions, pathname: string) {
  return `${service.url.replace(/\/$/, '')}${pathname}`
}

function serializableOptions(options: InstallPackageOptions) {
  return {
    client: options.client,
    limitConcurrency: options.limitConcurrency,
    networkConcurrency: options.networkConcurrency,
    additionalPackages: options.additionalPackages,
    isLocal: options.isLocal,
    installTimeout: options.installTimeout,
    debug: options.debug,
  }
}

async function requestInstallationService(
  service: InstallationServiceOptions,
  pathname: string,
  init: RequestInit,
  signal?: AbortSignal,
) {
  try {
    return await fetch(serviceUrl(service, pathname), {
      ...init,
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw new BuildCancelledError()
    throw new InstallationServiceUnavailableError(error)
  }
}

function throwServiceError(payload: unknown): never {
  const error = payload as {
    name?: string
    originalError?: unknown
    extra?: unknown
  }
  if (error?.name === 'PackageNotFoundError') {
    throw new PackageNotFoundError(error.originalError, error.extra)
  }
  throw new InstallError(error?.originalError ?? payload, error?.extra)
}

function isPackageInstallation(value: unknown): value is PackageInstallation {
  const installation = value as Partial<PackageInstallation>
  return (
    typeof installation?.packageString === 'string' &&
    typeof installation.packageName === 'string' &&
    typeof installation.installPath === 'string' &&
    typeof installation.packagePath === 'string'
  )
}

async function getRemoteInstallation(
  packageString: string,
  options: InstallPackageOptions,
): Promise<PackageInstallation> {
  const service = options.installationService!
  const response = await requestInstallationService(
    service,
    '/installations',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        packageString,
        options: serializableOptions(options),
      }),
    },
    options.signal,
  )

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new InstallationServiceUnavailableError(error)
  }
  if ([502, 503, 504].includes(response.status)) {
    throw new InstallationServiceUnavailableError(payload)
  }
  if (!response.ok) throwServiceError(payload)
  if (!isPackageInstallation(payload)) {
    throw new InstallationServiceUnavailableError(
      new Error('Installation service returned an invalid response'),
    )
  }

  return payload
}

/** Installs a package locally and returns the paths needed for analysis. */
export async function installPackage(
  packageString: string,
  options: InstallPackageOptions = {},
): Promise<PackageInstallation> {
  throwIfAborted(options.signal)
  const {
    name: packageName,
    normalPath,
    isLocal,
  } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(
    packageName,
    options.client,
    options.signal,
  )

  try {
    await InstallationUtils.installPackage(packageString, installPath, {
      ...options,
      installationService: undefined,
      isLocal,
    })
    return {
      packageString,
      packageName,
      installPath,
      packagePath:
        normalPath || path.join(installPath, 'node_modules', packageName),
    }
  } catch (error) {
    await InstallationUtils.cleanupPath(installPath)
    throw error
  }
}

/** Removes a locally owned installation. */
export async function disposePackage(installation: PackageInstallation) {
  await InstallationUtils.cleanupPath(installation.installPath)
}

/** Prepares an installation and an isolated directory for generated artifacts. */
export async function preparePackage(
  packageString: string,
  options: InstallPackageOptions = {},
  needsBuildPath = true,
): Promise<PreparedPackage> {
  throwIfAborted(options.signal)
  if (options.installationService) {
    try {
      const installation = await getRemoteInstallation(packageString, options)
      const buildPath = needsBuildPath
        ? await InstallationUtils.prepareBuildPath(
            installation.packageName,
            options.signal,
          )
        : installation.installPath
      return {
        ...installation,
        buildPath,
        async cleanup(retainLocalFiles = false) {
          if (needsBuildPath && !retainLocalFiles) {
            await InstallationUtils.cleanupPath(buildPath)
          }
        },
      }
    } catch (error) {
      if (
        !(error instanceof InstallationServiceUnavailableError) ||
        options.installationService.fallbackToLocal === false
      ) {
        throw error
      }
    }
  }

  const installation = await installPackage(packageString, options)
  return {
    ...installation,
    buildPath: installation.installPath,
    async cleanup(retainLocalFiles = false) {
      if (!retainLocalFiles) await disposePackage(installation)
    },
  }
}
