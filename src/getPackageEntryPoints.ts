import fs from 'node:fs/promises'
import path from 'node:path'
import { getPackageEntryPoints as discoverEntryPoints } from 'pkg-entry-points'
import type { InstallPackageOptions } from './common.types.js'
import {
  packageExtensions,
  resolvePackageModule,
} from './config/packageResolution.js'
import { preparePackage } from './packageInstallation.js'
import { getPackageImportPath, throwIfAborted } from './utils/common.utils.js'

const buildableExtensions = new Set(
  packageExtensions.filter(extension => extension !== '.json'),
)

function runnableTarget(file: string) {
  return (
    buildableExtensions.has(path.extname(file)) && !/\.d\.[cm]?ts$/.test(file)
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
    throwIfAborted(options.signal)
    const entries = await discoverEntryPoints(packagePath)
    throwIfAborted(options.signal)
    const candidates = new Set(Object.keys(entries))
    // The library infers legacy roots from main, while our bundler also uses
    // browser/module/style. Let the actual resolver decide whether '.' exists.
    if (manifest.exports === undefined) candidates.add('.')

    return [...candidates]
      .filter(entryPoint => {
        throwIfAborted(options.signal)
        const request =
          manifest.exports === undefined && entryPoint === '.'
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
