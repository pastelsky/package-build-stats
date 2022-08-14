import childProcess from 'child_process'
import path from 'path'
import builtInModules from 'builtin-modules'
import fs from 'fs'
import os from 'os'
import { last } from 'lodash'

const homeDirectory = os.homedir()

export function exec(command: string, options: any, timeout?: number) {
  let timerId: NodeJS.Timeout
  return new Promise((resolve, reject) => {
    const child = childProcess.exec(
      command,
      options,
      (error, stdout, stderr) => {
        if (error) {
          reject(stderr)
        } else {
          resolve(stdout)
        }

        if (timerId) {
          clearTimeout(timerId)
        }
      }
    )

    if (timeout) {
      timerId = setTimeout(() => {
        process.kill(child.pid)
        reject(
          `Execution of ${command.substring(
            0,
            40
          )}... cancelled as it exceeded a timeout of ${timeout} ms`
        )
      }, timeout)
    }
  })
}

/**
 * Gets external peerDeps that shouldn't be a
 * part of the build in a regex format -
 * /(^dep-a$|^dep-a\/|^dep-b$|^dep-b\/)\//
 */
export function getExternals(packageName: string, installPath: string) {
  const packageJSONPath = path.join(
    installPath,
    'node_modules',
    packageName,
    'package.json'
  )
  const packageJSON = require(packageJSONPath)
  const dependencies = Object.keys(packageJSON.dependencies || {})
  const peerDependencies = Object.keys(packageJSON.peerDependencies || {})

  // All packages with name same as a built-in node module, but
  // haven't explicitly been added as an npm dependency or aren't the package itself
  // are externals
  const builtInExternals = builtInModules.filter(
    mod => !dependencies.includes(mod) && mod !== packageName
  )
  return {
    externalPackages: peerDependencies,
    externalBuiltIns: builtInExternals,
  }
}

function expandTilde(pathString: string) {
  return homeDirectory
    ? pathString.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathString
}

function isLocalPackageString(packageString: string) {
  const packageJsonPath = path.resolve(packageString, 'package.json')
  try {
    if (fs.existsSync(packageJsonPath)) {
      return true
    }
  } catch (err) {
    return false
  }
}

function isScopedPackageString(packageString: string) {
  return packageString.startsWith('@')
}

type ParsePackageResult = {
  name: string
  version: string | null
  scoped: boolean
  importPath: string
  isLocal?: boolean
  normalPath: string
}

function parseLocalPackageString(packageString: string): ParsePackageResult {
  const fullPath = path.resolve(packageString, 'package.json')
  const packageJSON = require(fullPath)

  return {
    name: packageJSON.name,
    version: packageJSON.version,
    scoped: packageJSON.name.startsWith('@'),
    importPath: packageString,
    normalPath: packageString,
    isLocal: true,
  }
}

function parseScopedPackageString(packageString: string): ParsePackageResult {
  const lastAtIndex = packageString.lastIndexOf('@')
  const firstSlashIndex = packageString.indexOf('/')
  const secondSlashIndex = packageString.indexOf('/', firstSlashIndex + 1)

  const name = lastAtIndex === 0
    ? secondSlashIndex === -1
      ? packageString
      : packageString.substring(0, secondSlashIndex)
    : packageString.substring(0, lastAtIndex)
  const version = lastAtIndex === 0
    ? null
    : secondSlashIndex === -1
      ? packageString.substring(lastAtIndex + 1)
      : packageString.substring(lastAtIndex + 1, secondSlashIndex)
  const path = secondSlashIndex === -1
    ? null
    : packageString.substring(secondSlashIndex + 1)

  return {
    name,
    importPath: name + (path ? '/' + path : ''),
    version,
    normalPath: name + (version ? '@' + version : ''),
    scoped: true,
  }
}

function parseUnscopedPackageString(packageString: string): ParsePackageResult {
  const lastAtIndex = packageString.lastIndexOf('@')
  const firstSlashIndex = packageString.indexOf('/')

  const name = lastAtIndex === -1
    ? firstSlashIndex === -1
      ? packageString
      : packageString.substring(0, firstSlashIndex)
    : packageString.substring(0, lastAtIndex)
  const version = lastAtIndex === -1
    ? null
    : firstSlashIndex === -1
      ? packageString.substring(lastAtIndex + 1)
      : packageString.substring(lastAtIndex + 1, firstSlashIndex)
  const path = firstSlashIndex === -1
    ? null
    : packageString.substring(firstSlashIndex + 1)

  return {
    name,
    importPath: name + (path ? '/' + path : ''),
    version,
    normalPath: name + (version ? '@' + version : ''),
    scoped: false,
  }
}

export function parsePackageString(packageString: string): ParsePackageResult {
  const normalPackageString = expandTilde(packageString)

  if (isLocalPackageString(normalPackageString)) {
    return parseLocalPackageString(normalPackageString)
  } else if (isScopedPackageString(normalPackageString)) {
    return parseScopedPackageString(normalPackageString)
  } else {
    return parseUnscopedPackageString(normalPackageString)
  }
}
