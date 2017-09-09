const childProcess = require('child_process')
const path = require('path')
const escapeRegex = require('escape-string-regexp')

const config = require('../config')

function exec(command, options) {
  return new Promise((resolve, reject) => {
    childProcess
      .exec(command, options, function (error, stdout, stderr) {
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
function getExternals(packageName) {
  const packageJSONPath = path.join(config.tmp, 'node_modules', packageName, 'package.json')
  const packageJSON = require(packageJSONPath)
  let externalsRegex = ''

  if (packageJSON.peerDependencies) {
    externalsRegex = Object.keys(packageJSON.peerDependencies)
      .map(dep => `^${escapeRegex(dep)}$|^${escapeRegex(dep)}\\/`)
      .join('|')

    externalsRegex = `(${externalsRegex})`
  }

  return new RegExp(externalsRegex)
}

function parsePackageString(packageString) {
  // Scoped packages
  let name, version, scoped = false
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

  return { name, version, scoped }
}

module.exports = {
  exec,
  getExternals,
  parsePackageString
}
