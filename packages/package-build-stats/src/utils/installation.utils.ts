import rimraf from 'rimraf'
import shortId from 'shortid'
import path from 'path'
import { promises as fs } from 'fs'
import sanitize from 'sanitize-filename'
import semver from 'semver'

const debug = require('debug')('bp:worker')
import { InstallError, PackageNotFoundError } from '../errors/CustomError'
import { exec, parsePackageString } from './common.utils'
import config from '../config'
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
    await fs.mkdir(path.join(installPath, '.git'), {
      recursive: true,
    })
    await fs.writeFile(path.join(installPath, 'yarn.lock'), '')

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
    const { version } = parsePackageString(packageString)

    const {
      client = 'npm',
      limitConcurrency,
      networkConcurrency,
      additionalPackages = [],
      isLocal,
      installTimeout = 30000,
    } = installOptions

    if (client === 'yarn') {
      flags = ['exact', 'cached']
      command = `yarn add ${packageString} ${additionalPackages.join(
        ' '
      )} --${flags.join(' --')}`
    } else if (client === 'npm') {
      flags = [
        'registry=https://registry.npmjs.org',
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
        'legacy-peer-deps',
        'json',
      ]

      command = `npm install ${
        isLocal ? wrapPackCommand(packageString) : packageString
      } ${additionalPackages.join(' ')} --${flags.join(' --')}`
    } else if (client === 'pnpm') {
      flags = [
        'registry=https://registry.npmjs.org',
        'no-color',
        'no-optional',
        'loglevel error',
        'ignore-scripts',
        'save-exact',
        `store-dir=${path.join(config.tmp, 'cache', 'pnpm-cache')}`,
        `virtual-store-dir=${path.join(
          config.tmp,
          'cache',
          'pnpm-cache-virtual'
        )}`,
      ]

      if (semver.valid(version)) {
        flags.push(`prefer-offline`)
      }

      command = `pnpm add ${packageString} ${additionalPackages.join(
        ' '
      )} --${flags.join(' --')}`
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
      console.error('Install failed due to ', err)
      Telemetry.installPackage(
        packageString,
        false,
        installStartTime,
        installOptions
      )

      // @ts-ignore
      if (
        typeof err === 'string' &&
        // Yarn NPM || PNPM
        /\b404\b/.test(err)
      ) {
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
