const childProcess = require('child_process')
const path = require('path')
const builtInModules = require('builtin-modules')
const fs = require('fs')

const config = require('../config')

function exec(command, options) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, options, function(error, stdout, stderr) {
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
  const builtInExternals = builtInModules.filter(mod => !dependencies.includes(mod))
  return {
    externalPackages: peerDependencies,
    externalBuiltIns: builtInExternals
  }
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

function parsePackageString(packageString) {
  // Scoped packages
  let name,
    version,
    scoped = false,
    isLocal = false

  if (isLocalPackageString(packageString)) {
    const fullPath = path.resolve(packageString, 'package.json')
    const packageJSON = require(fullPath)
    name = packageJSON.name
    version = packageJSON.version
    isLocal = true

    if (name.startsWith('@')) {
      scope = true
    }
  } else {
    const lastAtIndex = packageString.lastIndexOf('@')

    if (packageString.startsWith('@')) {
      scoped = true
      if (lastAtIndex === 0) {
        name = packageString
        version = null
      } else {
        name = packageString.substring(0, lastAtIndex)
        version = packageString.substring(lastAtIndex + 1)
      }
    } else {
      if (lastAtIndex === -1) {
        name = packageString
        version = null
      } else {
        name = packageString.substring(0, lastAtIndex)
        version = packageString.substring(lastAtIndex + 1)
      }
    }
  }

  return { name, version, scoped, isLocal }
}

module.exports = {
  exec,
  getExternals,
  parsePackageString,
}
