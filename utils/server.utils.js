const childProcess = require('child_process')
const path = require('path')

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
 * part of the build in the format -
 * {  peerDep: 'peerDep' }
 */
function getExternals(packageName) {
  const externals = {}
  const packageJSONPath = path.join(config.tmp, 'node_modules', packageName, 'package.json')
  const packageJSON = require(packageJSONPath)

  if (packageJSON.peerDependencies) {
    Object.keys(packageJSON.peerDependencies)
      .forEach(peerDep => {
        externals[peerDep] = peerDep
      })
  }
  return externals
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
  parsePackageString,
}
