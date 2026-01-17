import { rimraf } from 'rimraf'
import path from 'path'
import fs from 'fs/promises'
import sanitize from 'sanitize-filename'
import { randomUUID } from 'crypto'
import createDebug from 'debug'

const debug = createDebug('bp:worker')
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
    const id = randomUUID().slice(0, 8)
    return path.join(
      config.tmp,
      'packages',
      sanitize(`build-${packageName}-${id}`),
    )
  },

  async preparePath(
    packageName: string,
    clientOption?:
      | 'npm'
      | 'yarn'
      | 'pnpm'
      | 'bun'
      | Array<'npm' | 'yarn' | 'pnpm' | 'bun'>,
  ) {
    const startTime = performance.now()
    const installPath = InstallationUtils.getInstallPath(packageName)

    if (process.env.DEBUG_TIMING) {
      console.log(
        `[TIMING] preparePath.getInstallPath: ${(performance.now() - startTime).toFixed(2)}ms`,
      )
    }

    const step1 = performance.now()
    await fs.mkdir(config.tmp, { recursive: true })
    await fs.mkdir(installPath, { recursive: true })
    if (process.env.DEBUG_TIMING) {
      console.log(
        `[TIMING] preparePath.mkdir: ${(performance.now() - step1).toFixed(2)}ms`,
      )
    }

    const step2 = performance.now()

    // Check if yarn is being used (either as single value or in array)
    const clients = clientOption
      ? Array.isArray(clientOption)
        ? clientOption
        : [clientOption]
      : []
    const isUsingYarn = clients.includes('yarn')

    const packageJson: any = {
      dependencies: {},
      browserslist: [
        'last 5 Chrome versions',
        'last 5 Firefox versions',
        'Safari >= 9',
        'edge >= 12',
      ],
    }

    // Add packageManager field if yarn is being used (required by corepack)
    if (isUsingYarn) {
      packageJson.packageManager = 'yarn@1.22.22'
    }

    await fs.writeFile(
      path.join(installPath, 'package.json'),
      JSON.stringify(packageJson),
    )
    if (process.env.DEBUG_TIMING) {
      console.log(
        `[TIMING] preparePath.writeFile: ${(performance.now() - step2).toFixed(2)}ms`,
      )
      console.log(
        `[TIMING] preparePath.total: ${(performance.now() - startTime).toFixed(2)}ms`,
      )
    }

    return installPath
  },

  async installPackage(
    packageString: string,
    installPath: string,
    installOptions: InstallPackageOptions,
  ) {
    const {
      client = ['bun', 'npm'], // Default: try bun first, fallback to npm
      limitConcurrency: _limitConcurrency,
      networkConcurrency: _networkConcurrency,
      additionalPackages: _additionalPackages = [],
      isLocal: _isLocal,
      installTimeout: _installTimeout = 45000,
    } = installOptions

    // Normalize client to array
    const clients = Array.isArray(client) ? client : [client]

    // Try each client in order until one succeeds
    let lastError: any = null
    for (let i = 0; i < clients.length; i++) {
      const currentClient = clients[i]
      const isLastClient = i === clients.length - 1

      try {
        await InstallationUtils._installWithClient(
          packageString,
          installPath,
          {
            ...installOptions,
            client: currentClient,
          },
          currentClient,
        )

        // Success! Log which client was used
        if (installOptions.debug || process.env.DEBUG_TIMING) {
          console.log(`[INSTALL] Successfully installed with ${currentClient}`)
        }
        return
      } catch (error) {
        lastError = error

        if (!isLastClient) {
          // Try next client
          debug(
            `Installation with ${currentClient} failed, trying next client...`,
          )
          if (installOptions.debug) {
            console.log(
              `[INSTALL] ${currentClient} failed, trying ${clients[i + 1]}...`,
            )
          }
        }
      }
    }

    // All clients failed
    throw lastError
  },

  async _installWithClient(
    packageString: string,
    installPath: string,
    installOptions: InstallPackageOptions,
    currentClient: 'npm' | 'yarn' | 'pnpm' | 'bun',
  ) {
    let flags, command
    let installStartTime = performance.now()

    const {
      limitConcurrency,
      networkConcurrency,
      additionalPackages = [],
      isLocal,
      installTimeout = 45000,
    } = installOptions

    if (currentClient === 'yarn') {
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
        ' ',
      )} --${flags.join(' --')}`
    } else if (currentClient === 'npm') {
      flags = [
        // Setting cache is required for concurrent `npm install`s to work
        `cache=${path.join(config.tmp, 'cache')}`,
        'no-package-lock',
        'no-shrinkwrap',
        'legacy-peer-deps',
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
    } else if (currentClient === 'pnpm') {
      flags = ['no-optional', 'loglevel error', 'ignore-scripts', 'save-exact']

      command = `pnpm add ${packageString} ${additionalPackages.join(
        ' ',
      )} --${[].join(' --')}`
    } else if (currentClient === 'bun') {
      flags = [
        'no-save', // Don't update package.json or save lockfile
        'production', // Don't install devDependencies
        'ignore-scripts', // Skip lifecycle scripts
        'no-progress', // Disable progress bar
        'silent', // Don't log anything
      ]

      // Add network concurrency if specified
      if (networkConcurrency) {
        flags.push(`network-concurrency=${networkConcurrency}`)
      }

      command = `bun add ${packageString} ${additionalPackages.join(
        ' ',
      )} --${flags.join(' --')}`
    } else {
      console.error('No valid client specified')
      process.exit(1)
    }

    debug('install start %s', packageString)

    try {
      const execStartTime = performance.now()
      await exec(
        command,
        {
          cwd: installPath,
          maxBuffer: 1024 * 500,
        },
        installTimeout,
      )
      const execDuration = performance.now() - execStartTime

      if (process.env.DEBUG_TIMING) {
        console.log(
          `[TIMING] installPackage.exec (${currentClient}): ${execDuration.toFixed(2)}ms`,
        )
      }

      debug('install finish %s', packageString)
      Telemetry.installPackage(packageString, true, installStartTime, {
        ...installOptions,
        client: currentClient,
      })
    } catch (err) {
      if (installOptions.debug || process.env.DEBUG_TIMING) {
        console.log(`[INSTALL ERROR] ${currentClient}:`, err)
      }
      Telemetry.installPackage(packageString, false, installStartTime, {
        ...installOptions,
        client: currentClient,
      })
      if (typeof err === 'string' && err.includes('code E404')) {
        throw new PackageNotFoundError(err)
      } else {
        throw new InstallError(err)
      }
    }
  },

  async cleanupPath(installPath: string) {
    try {
      await rimraf(installPath)
    } catch (err) {
      console.error('cleaning up path ', installPath, ' failed due to ', err)
    }
  },
}

export default InstallationUtils
