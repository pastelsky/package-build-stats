import path from 'node:path'
import type {
  InstallPackageOptions,
  PackageInstallation,
} from './common.types.js'
import { parsePackageString, throwIfAborted } from './utils/common.utils.js'
import InstallationUtils from './utils/installation.utils.js'

export type PreparedPackage = PackageInstallation & {
  buildPath: string
  cleanup(retainLocalFiles?: boolean): Promise<void>
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
      installationProvider: undefined,
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
  if (!options.installationProvider) {
    const installation = await installPackage(packageString, options)
    return {
      ...installation,
      buildPath: installation.installPath,
      async cleanup(retainLocalFiles = false) {
        if (!retainLocalFiles) await disposePackage(installation)
      },
    }
  }

  const installation = await options.installationProvider(
    packageString,
    options,
  )
  try {
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
        try {
          if (needsBuildPath && !retainLocalFiles) {
            await InstallationUtils.cleanupPath(buildPath)
          }
        } finally {
          await installation.release()
        }
      },
    }
  } catch (error) {
    await installation.release()
    throw error
  }
}
