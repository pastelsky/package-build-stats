import path from 'path'
import fs from 'fs/promises'
import memoize from 'memoizee'
import findUp from 'find-up'
import { FileSystem } from '@parcel/fs'

export const getPackageRoot = (filePath: string, specifier: string) => {
  const parts = filePath.split(path.sep)
  if (parts.includes('node_modules')) {
    const lastNodeModules = parts.lastIndexOf('node_modules')
    const isScopedPackage = parts[lastNodeModules + 1].startsWith('@')
    const packageRoot = parts
      .slice(0, lastNodeModules + (isScopedPackage ? 3 : 2))
      .join(path.sep)

    return {
      packageRoot,
      packageName: isScopedPackage
        ? [parts[lastNodeModules + 1], parts[lastNodeModules + 2]].join(
            path.sep
          )
        : parts[lastNodeModules + 1],
    }
  } else {
    // Likely a top level main package route
    const packageJSONPath = findUp.sync('package.json', {
      cwd: filePath,
    })
    if (packageJSONPath) {
      return {
        packageRoot: path.dirname(packageJSONPath),
        packageName: specifier,
      }
    } else {
      throw new Error(
        `Could not find package.json for ${filePath} - are you sure you're in a package root?`
      )
    }
  }
}

export const readJSONFile = async (filePath: string) => {
  const fileContents = await fs.readFile(filePath, 'utf8')
  return JSON.parse(fileContents)
}

export const readJSONFileFromFS = async (fs: FileSystem, filePath: string) => {
  const fileContents = await fs.readFile(filePath, 'utf8')
  return JSON.parse(fileContents)
}

export const isPackageSpecifier = (specifier: string) =>
  !(specifier.startsWith('.') || specifier.startsWith('/'))

export const isSpecifierNotIgnored = (
  specifier: string,
  peerDependencies: { [key: string]: string }
) => !peerDependencies[getDependencyFromSpecifier(specifier)]

export const getDependencyFromSpecifier = (specifier: string) => {
  const parts = specifier.split('/')
  const depNameFromSpecifier = parts[0].startsWith('@')
    ? [parts[0], parts[1]].join(path.sep)
    : parts[0]

  return depNameFromSpecifier
}

export const getPackageJSONDetails = memoize(
  async packageRoot => {
    const requireeJSON = await readJSONFile(
      path.join(packageRoot, 'package.json')
    )

    return {
      dependencies: {},
      peerDependencies: {},
      ...requireeJSON,
    }
  },
  { max: 1000 }
)

export function notEmpty<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined
}
