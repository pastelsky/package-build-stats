import path from 'node:path'
import type { InstallPackageOptions } from './common.types.js'
import InstallationUtils from './utils/installation.utils.js'
import { parsePackageString, throwIfAborted } from './utils/common.utils.js'
import { getImportPointsFromPackage } from './utils/importPoints.utils.js'

export default async function getPackageImportPoints(
  packageString: string,
  options: InstallPackageOptions = {},
) {
  const { name: packageName, isLocal } = parsePackageString(packageString)
  const installPath = await InstallationUtils.preparePath(
    packageName,
    options.client,
    options.signal,
  )

  try {
    throwIfAborted(options.signal)
    await InstallationUtils.installPackage(packageString, installPath, {
      ...options,
      isLocal,
    })
    throwIfAborted(options.signal)

    const packagePath = path.join(installPath, 'node_modules', packageName)
    return await getImportPointsFromPackage(
      packageName,
      packagePath,
      options.signal,
    )
  } finally {
    if (!options.debug) {
      await InstallationUtils.cleanupPath(installPath)
    }
  }
}
