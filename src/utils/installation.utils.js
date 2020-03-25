const shortId = require('shortid')
const mkdir = require('mkdir-promise')
const rimraf = require('rimraf')
const path = require('path')
const fs = require('fs')
const sanitize = require('sanitize-filename')
const debug = require('debug')('bp:worker')
const CustomError = require('../CustomError')
const { exec } = require('./common.utils')
const config = require('../config')

// When operating on a local directory, force npm to copy directory structure
// and all dependencies instead of just symlinking files
const wrapPackCommand = packagePath => `$(npm pack ${packagePath} | tail -1)`

const InstallationUtils = {
  getInstallPath(packageName) {
    const id = shortId.generate().slice(0, 3)
    return path.join(
      config.tmp,
      'packages',
      sanitize(`build-${packageName}-${id}`)
    )
  },

  async preparePath(packageName) {
    const installPath = InstallationUtils.getInstallPath(packageName)

    await mkdir(config.tmp)
    await mkdir(installPath)

    fs.writeFileSync(
      path.join(installPath, 'package.json'),
      JSON.stringify({ dependencies: {} })
    )

    return installPath
  },

  async installPackage(
    packageString,
    installPath,
    {
      client,
      limitConcurrency,
      networkConcurrency,
      additionalPackages = [],
      isLocal,
    }
  ) {
    let flags, command

    if (client === 'yarn') {
      flags = [
        'ignore-flags',
        'ignore-engines',
        'skip-integrity-check',
        'exact',
        'json',
        'no-progress',
        'silent',
        'no-lockfile',
        'no-bin-links',
        'ignore-optional',
      ]
      if (limitConcurrency) {
        flags.push('mutex network')
      }

      if (networkConcurrency) {
        flags.push(`network-concurrency ${networkConcurrency}`)
      }
      command = `yarn add ${packageString} ${additionalPackages.join(
        ' '
      )} --${flags.join(' --')}`
    } else {
      flags = [
        // Setting cache is required for concurrent `npm install`s to work
        `cache=${path.join(config.tmp, 'cache')}`,
        'no-package-lock',
        'no-shrinkwrap',
        'no-optional',
        'no-bin-links',
        'prefer-offline',
        'progress false',
        'loglevel error',
        'ignore-scripts',
        'save-exact',
        'production',
        'json',
      ]

      command = `npm install ${
        isLocal ? wrapPackCommand(packageString) : packageString
      } ${additionalPackages.join(' ')} --${flags.join(' --')}`
    }

    debug('install start %s', packageString)

    try {
      await exec(command, {
        cwd: installPath,
        maxBuffer: 1024 * 500,
      })
      debug('install finish %s', packageString)
    } catch (err) {
      console.log(err)
      if (err.includes('code E404')) {
        throw new CustomError('PackageNotFoundError', err)
      } else {
        throw new CustomError('InstallError', err)
      }
    }
  },

  async cleaupPath(installPath) {
    const noop = () => {}
    await rimraf(installPath, noop)
  },
}

module.exports = InstallationUtils
