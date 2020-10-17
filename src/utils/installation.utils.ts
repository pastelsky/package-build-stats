import shortId from 'shortid'
import rimraf from 'rimraf'
import path from 'path'
import { promises as fs } from 'fs'
import sanitize from 'sanitize-filename'

const debug = require('debug')('bp:worker')
import { InstallError, PackageNotFoundError } from '../errors/CustomError'
import { exec } from './common.utils'
import config from '../config/config'
import { InstallPackageOptions } from '../common.types'

// When operating on a local directory, force npm to copy directory structure
// and all dependencies instead of just symlinking files
const wrapPackCommand = (packagePath: string) =>
  `$(npm pack --ignore-scripts ${packagePath} | tail -1)`

const InstallationUtils = {
  getInstallPath(packageName: string) {
    const id = shortId.generate().slice(0, 3)
    return path.join(
      config.tmp,
      'packages',
      sanitize(`build-${packageName}-${id}`)
    )
  },

  async preparePath(packageName: string) {
    const installPath = InstallationUtils.getInstallPath(packageName)

    await fs.mkdir(config.tmp, { recursive: true })
    await fs.mkdir(installPath, { recursive: true })

    await fs.writeFile(
      path.join(installPath, 'package.json'),
      JSON.stringify({ dependencies: {} })
    )

    return installPath
  },

  async installPackage(
    packageString: string,
    installPath: string,
    {
      client,
      limitConcurrency,
      networkConcurrency,
      additionalPackages = [],
      isLocal,
    }: InstallPackageOptions
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
        throw new PackageNotFoundError(err)
      } else {
        throw new InstallError(err)
      }
    }
  },

  async cleaupPath(installPath: string) {
    const noop = () => {}
    await rimraf(installPath, noop)
  },
}

export default InstallationUtils
