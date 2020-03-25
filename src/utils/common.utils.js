const childProcess = require('child_process')
const path = require('path')
const builtInModules = require('builtin-modules')
const fs = require('fs')
const os = require('os')

const homeDirectory = os.homedir()

function exec(command, options) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, options, function (error, stdout, stderr) {
      if (error) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

/**
 * Gets external peerDeps that shouldn't be a
 * part of the build in a regex format -
 * /(^dep-a$|^dep-a\/|^dep-b$|^dep-b\/)\//
 */
function getExternals(packageName, installPath) {
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
  // haven't explicitly been added as an npm dependency are externals
  const builtInExternals = builtInModules.filter(
    mod => !dependencies.includes(mod)
  )
  return {
    externalPackages: peerDependencies,
    externalBuiltIns: builtInExternals,
  }
}

function expandTilde(pathString) {
  return homeDirectory
    ? pathString.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathString
}

function isLocalPackageString(packageString) {
  const packageJsonPath = path.resolve(packageString, 'package.json')
  try {
    if (fs.existsSync(packageJsonPath)) {
      return true
    }
  } catch (err) {
    return false
  }
}

function isScopedPackageString(packageString) {
  return packageString.startsWith('@')
}

function parseLocalPackageString(packageString) {
  const fullPath = path.resolve(packageString, 'package.json')
  const packageJSON = require(fullPath)

  return {
    name: packageJSON.name,
    version: packageJSON.version,
    scoped: packageJSON.name.startsWith('@'),
    normalPath: packageString,
    isLocal: true,
  }
}

function parseScopedPackageString(packageString) {
  const lastAtIndex = packageString.lastIndexOf('@')
  return {
    name:
      lastAtIndex === 0
        ? packageString
        : packageString.substring(0, lastAtIndex),
    version:
      lastAtIndex === 0 ? null : packageString.substring(lastAtIndex + 1),
    scoped: true,
    isLocal: false,
  }
}

function parseUnscopedPackageString(packageString) {
  const lastAtIndex = packageString.lastIndexOf('@')
  return {
    name:
      lastAtIndex === -1
        ? packageString
        : packageString.substring(0, lastAtIndex),
    version:
      lastAtIndex === -1 ? null : packageString.substring(lastAtIndex + 1),
    scoped: false,
    isLocal: false,
  }
}

function parsePackageString(packageString) {
  const normalPackageString = expandTilde(packageString)

  if (isLocalPackageString(normalPackageString)) {
    return parseLocalPackageString(normalPackageString)
  } else if (isScopedPackageString(normalPackageString)) {
    return parseScopedPackageString(normalPackageString)
  } else {
    return parseUnscopedPackageString(normalPackageString)
  }
}

module.exports = {
  exec,
  getExternals,
  parsePackageString,
}
