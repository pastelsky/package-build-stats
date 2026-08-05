import { rimraf } from 'rimraf'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import sanitize from 'sanitize-filename'
import createDebug from 'debug'

const debug = createDebug('bp:worker')
import {
  BuildCancelledError,
  InstallError,
  PackageNotFoundError,
} from '../errors/CustomError.js'
import { exec, ProcessExecutionError, throwIfAborted } from './common.utils.js'
import config from '../config/config.js'
import { packageManagers } from '../common.types.js'
import type { InstallPackageOptions, PackageManager } from '../common.types.js'
import Telemetry from './telemetry.utils.js'

const cachePath = path.join(config.tmp, 'cache')

async function packLocalPackage(
  packagePath: string,
  installPath: string,
  timeout: number,
  signal?: AbortSignal,
) {
  const output = await exec(
    'npm',
    [
      'pack',
      '--ignore-scripts',
      '--json',
      `--cache=${cachePath}`,
      '--loglevel=error',
      packagePath,
    ],
    { cwd: installPath, maxBuffer: 1024 * 500, signal },
    timeout,
  )
  const filename = (JSON.parse(output) as Array<{ filename?: unknown }>)[0]
    ?.filename

  if (typeof filename !== 'string' || path.basename(filename) !== filename) {
    throw new Error('npm pack did not return a valid tarball filename')
  }

  return path.join(installPath, filename)
}

const flags = (value: string) => value.split(' ')
const installFlags = {
  yarn: flags(
    '--ignore-flags --ignore-engines --skip-integrity-check --exact --json --no-progress --silent --no-lockfile --no-bin-links --ignore-optional',
  ),
  npm: flags(
    `--cache=${cachePath} --no-package-lock --no-shrinkwrap --legacy-peer-deps --no-optional --no-bin-links --progress=false --loglevel=error --ignore-scripts --save-exact --production --json`,
  ),
  pnpm: flags('--no-optional --loglevel=error --ignore-scripts --save-exact'),
  bun: flags(
    `--cache-dir=${path.join(cachePath, 'bun')} --no-save --production --ignore-scripts --no-progress --silent`,
  ),
} satisfies Record<PackageManager, string[]>

function getInstallArgs(
  client: PackageManager,
  packageString: string,
  options: InstallPackageOptions,
) {
  const { additionalPackages = [], networkConcurrency } = options
  const args = [
    client === 'npm' ? 'install' : 'add',
    packageString,
    ...additionalPackages,
    ...installFlags[client],
  ]

  if (client === 'yarn' && options.limitConcurrency) {
    args.push('--mutex', 'network')
  }
  if (networkConcurrency && client === 'yarn') {
    args.push('--network-concurrency', String(networkConcurrency))
  }
  if (networkConcurrency && client === 'bun') {
    args.push(`--network-concurrency=${networkConcurrency}`)
  }

  return args
}

const InstallationUtils = {
  getInstallPath(packageName: string, directory = 'packages') {
    const id = randomUUID().slice(0, 8)
    return path.join(
      config.tmp,
      directory,
      sanitize(`build-${packageName}-${id}`),
    )
  },

  async preparePath(
    packageName: string,
    clientOption?: PackageManager | PackageManager[],
    signal?: AbortSignal,
    directory = 'packages',
  ) {
    throwIfAborted(signal)
    const startTime = performance.now()
    const installPath = InstallationUtils.getInstallPath(packageName, directory)

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

  async prepareBuildPath(packageName: string, signal?: AbortSignal) {
    return InstallationUtils.preparePath(
      packageName,
      undefined,
      signal,
      'artifacts',
    )
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
    let lastError: unknown
    for (let i = 0; i < clients.length; i++) {
      const currentClient = clients[i]
      const isLastClient = i === clients.length - 1

      try {
        // Package managers are ordered fallbacks, not parallel alternatives.
        // oxlint-disable-next-line no-await-in-loop
        await InstallationUtils.installWithClient(
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
        if (error instanceof BuildCancelledError) {
          throw error
        }
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
    throw lastError ?? new InstallError('No package manager was configured')
  },

  async installWithClient(
    packageString: string,
    installPath: string,
    installOptions: InstallPackageOptions,
    currentClient: PackageManager,
  ) {
    if (!packageManagers.includes(currentClient)) {
      throw new TypeError(`Unsupported package manager: ${currentClient}`)
    }

    const installStartTime = performance.now()

    const { isLocal, installTimeout = 45000, signal } = installOptions

    debug('install start %s', packageString)

    try {
      const packageToInstall = isLocal
        ? await packLocalPackage(
            packageString,
            installPath,
            installTimeout,
            signal,
          )
        : packageString

      const execStartTime = performance.now()
      await exec(
        currentClient,
        getInstallArgs(currentClient, packageToInstall, installOptions),
        {
          cwd: installPath,
          maxBuffer: 1024 * 500,
          signal,
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
      if (err instanceof BuildCancelledError) {
        throw err
      }
      if (installOptions.debug || process.env.DEBUG_TIMING) {
        console.log(`[INSTALL ERROR] ${currentClient}:`, err)
      }
      Telemetry.installPackage(packageString, false, installStartTime, {
        ...installOptions,
        client: currentClient,
      })
      if (
        err instanceof ProcessExecutionError &&
        `${err.stderr}\n${err.stdout}`.includes('code E404')
      ) {
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
