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
import Telemetry from './telemetry.utils'
import { performance } from 'perf_hooks'

// When operating on a local directory, force npm to copy directory structure
// and all dependencies instead of just symlinking files
const wrapPackCommand = (packagePath: string) =>
  `$(npm pack --ignore-scripts ${packagePath} | tail -1)`

const InstallationUtils = {
  getInstallPath(packageName: string) {
    const id = shortId.generate().slice(0, 3)
    return path.join(config.tmp, 'packages', sanitize(`build-${packageName}`))
  },

  async preparePath(packageName: string) {
    const installPath = InstallationUtils.getInstallPath(packageName)

    await fs.mkdir(config.tmp, { recursive: true })
    await fs.mkdir(installPath, { recursive: true })

    await fs.writeFile(
      path.join(installPath, 'package.json'),
      JSON.stringify({
        dependencies: {},
        browserslist: [
          'last 5 Chrome versions',
          'last 5 Firefox versions',
          'Safari >= 9',
          'edge >= 12',
        ],
      })
    )

    return installPath
  },

  async installPackage(
    packageString: string,
    installPath: string,
    installOptions: InstallPackageOptions
  ) {
    let flags, command
    let installStartTime = performance.now()

    const {
      client = 'npm',
      limitConcurrency,
      networkConcurrency,
      additionalPackages = [],
      isLocal,
      installTimeout = 30000,
    } = installOptions

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
        'no-audit',
        'no-fund',
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
    } else if (client === 'npm') {
      flags = [
        // Setting cache is required for concurrent `npm install`s to work
        `cache=${path.join(config.tmp, 'cache')}`,
        'no-package-lock',
        'no-shrinkwrap',
        'no-optional',
        'no-bin-links',
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
    } else if (client === 'pnpm') {
      console.log('CLIENT IS PNPM')
      flags = [
        'no-optional',
        'loglevel error',
        'ignore-scripts',
        'save-exact',
        'use-store-server',
        'ignore-optional',
      ]

      command = `pnpm add ${packageString} ${additionalPackages.join(
        ' '
      )} --${[].join(' --')}`
    } else {
      console.error('No valid client specified')
      process.exit(1)
    }

    debug('install start %s', packageString)

    try {
      await exec(
        command,
        {
          cwd: installPath,
          maxBuffer: 1024 * 500,
        },
        installTimeout
      )

      debug('install finish %s', packageString)
      Telemetry.installPackage(
        packageString,
        true,
        installStartTime,
        installOptions
      )
    } catch (err) {
      console.log(err)
      Telemetry.installPackage(
        packageString,
        false,
        installStartTime,
        installOptions
      )
      if (typeof err === 'string' && err.includes('code E404')) {
        throw new PackageNotFoundError(err)
      } else {
        throw new InstallError(err)
      }
    }
  },

  async cleanupPath(installPath: string) {
    const noop = () => {}
    try {
      await rimraf(installPath, noop)
    } catch (err) {
      console.error('cleaning up path ', installPath, ' failed due to ', err)
    }
  },
}

export default InstallationUtils
