import childProcess from 'node:child_process'
import fs from 'node:fs'
import { builtinModules } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { BuildCancelledError } from '../errors/CustomError.js'

const homeDirectory = os.homedir()

interface ExecOptions extends childProcess.SpawnOptions {
  maxBuffer?: number
}

export class ProcessExecutionError extends Error {
  constructor(
    message: string,
    readonly stdout = '',
    readonly stderr = '',
    readonly exitCode: number | null = null,
    readonly signal: NodeJS.Signals | null = null,
  ) {
    super(message)
    this.name = 'ProcessExecutionError'
  }

  toJSON() {
    return this.stderr || this.message
  }
}

export const getBuiltInModules = () =>
  builtinModules.flatMap(mod => [mod, 'node:' + mod])

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new BuildCancelledError()
  }
}

function killProcessTree(child: childProcess.ChildProcess) {
  if (!child.pid) {
    return
  }

  try {
    if (process.platform === 'win32') {
      childProcess.spawnSync(
        'taskkill',
        ['/pid', String(child.pid), '/T', '/F'],
        { windowsHide: true },
      )
    } else {
      process.kill(-child.pid, 'SIGKILL')
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error
    }
  }
}

export function exec(
  command: string,
  args: readonly string[],
  options: ExecOptions,
  timeout?: number,
): Promise<string> {
  let timerId: NodeJS.Timeout | undefined
  return new Promise<string>((resolve, reject) => {
    const { maxBuffer = 1024 * 1024, signal, ...spawnOptions } = options
    if (signal?.aborted) {
      reject(new BuildCancelledError())
      return
    }
    const child = childProcess.spawn(command, args, {
      ...spawnOptions,
      detached: process.platform !== 'win32',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutLength = 0
    let stderrLength = 0
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      if (timerId) {
        clearTimeout(timerId)
      }
      signal?.removeEventListener('abort', onAbort)
      callback()
    }

    const rejectAndKill = (message: string) => {
      finish(() => {
        try {
          killProcessTree(child)
        } catch (error) {
          reject(error)
          return
        }
        reject(
          new ProcessExecutionError(
            message,
            Buffer.concat(stdout).toString(),
            Buffer.concat(stderr).toString(),
          ),
        )
      })
    }

    const onAbort = () => {
      finish(() => {
        try {
          killProcessTree(child)
        } catch (error) {
          reject(error)
          return
        }
        reject(new BuildCancelledError())
      })
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout.push(chunk)
      stdoutLength += chunk.length
      if (stdoutLength > maxBuffer) {
        rejectAndKill(`stdout exceeded maxBuffer of ${maxBuffer} bytes`)
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
      stderrLength += chunk.length
      if (stderrLength > maxBuffer) {
        rejectAndKill(`stderr exceeded maxBuffer of ${maxBuffer} bytes`)
      }
    })

    child.once('error', error => {
      finish(() => reject(error))
    })

    child.once('close', (code, exitSignal) => {
      finish(() => {
        const stdoutText = Buffer.concat(stdout).toString()
        const stderrText = Buffer.concat(stderr).toString()
        if (code === 0) {
          resolve(stdoutText)
        } else {
          reject(
            new ProcessExecutionError(
              stderrText.trim() ||
                `Command exited with ${exitSignal ? `signal ${exitSignal}` : `code ${code}`}`,
              stdoutText,
              stderrText,
              code,
              exitSignal,
            ),
          )
        }
      })
    })

    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
      return
    }

    if (timeout) {
      timerId = setTimeout(() => {
        rejectAndKill(
          `Execution of ${command.substring(
            0,
            40,
          )}... cancelled as it exceeded a timeout of ${timeout} ms`,
        )
      }, timeout)
    }
  })
}

/**
 * Gets external peerDeps that shouldn't be a
 * part of the build in a regex format -
 * /(^dep-a$|^dep-a\/|^dep-b$|^dep-b\/)\//
 */
export function getExternals(packageName: string, installPath: string) {
  const packageJSONPath = path.join(
    installPath,
    'node_modules',
    packageName,
    'package.json',
  )
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'))
  const dependencies = Object.keys(packageJSON.dependencies || {})
  const peerDependencies = Object.keys(packageJSON.peerDependencies || {})

  // All packages with name same as a built-in node module, but
  // haven't explicitly been added as an npm dependency or aren't the package itself
  // are externals
  const builtInExternals = getBuiltInModules().filter(
    mod => !dependencies.includes(mod) && mod !== packageName,
  )
  return {
    externalPackages: peerDependencies,
    externalBuiltIns: builtInExternals,
  }
}

function expandTilde(pathString: string) {
  return homeDirectory
    ? pathString.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathString
}

function isLocalPackageString(packageString: string) {
  const packageJsonPath = path.resolve(packageString, 'package.json')
  try {
    if (fs.existsSync(packageJsonPath)) {
      return true
    }
  } catch {
    return false
  }
}

function isScopedPackageString(packageString: string) {
  return packageString.startsWith('@')
}

type ParsePackageResult = {
  name: string
  version: string | null
  scoped: boolean
  isLocal?: boolean
  normalPath?: string
}

function parseLocalPackageString(packageString: string): ParsePackageResult {
  const fullPath = path.resolve(packageString, 'package.json')
  const packageJSON = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))

  return {
    name: packageJSON.name,
    version: packageJSON.version,
    scoped: packageJSON.name.startsWith('@'),
    normalPath: packageString,
    isLocal: true,
  }
}

function parseScopedPackageString(packageString: string): ParsePackageResult {
  const lastAtIndex = packageString.lastIndexOf('@')
  return {
    name:
      lastAtIndex === 0
        ? packageString
        : packageString.substring(0, lastAtIndex),
    version:
      lastAtIndex === 0 ? null : packageString.substring(lastAtIndex + 1),
    scoped: true,
  }
}

function parseUnscopedPackageString(packageString: string): ParsePackageResult {
  const lastAtIndex = packageString.lastIndexOf('@')
  return {
    name:
      lastAtIndex === -1
        ? packageString
        : packageString.substring(0, lastAtIndex),
    version:
      lastAtIndex === -1 ? null : packageString.substring(lastAtIndex + 1),
    scoped: false,
  }
}

export function parsePackageString(packageString: string): ParsePackageResult {
  const normalPackageString = expandTilde(packageString)

  if (isLocalPackageString(normalPackageString)) {
    return parseLocalPackageString(normalPackageString)
  } else if (isScopedPackageString(normalPackageString)) {
    return parseScopedPackageString(normalPackageString)
  } else {
    return parseUnscopedPackageString(normalPackageString)
  }
}
