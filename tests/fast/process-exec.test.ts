import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { exec, type ProcessExecutionError } from '../../src/utils/common.utils'

const isProcessRunning = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const waitForProcessToExit = async (pid: number, timeout: number) => {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }

  return !isProcessRunning(pid)
}

describe.runIf(process.platform !== 'win32')('exec process cleanup', () => {
  test('returns stdout for a successful command', async () => {
    await expect(
      exec(process.execPath, ['-e', "process.stdout.write('completed')"], {}),
    ).resolves.toBe('completed')
  })

  test('returns a structured error for a failed command', async () => {
    await expect(
      exec(
        process.execPath,
        ['-e', "process.stderr.write('failed'); process.exit(2)"],
        {},
      ),
    ).rejects.toMatchObject({
      name: 'ProcessExecutionError',
      message: 'failed',
      stderr: 'failed',
      exitCode: 2,
    } satisfies Partial<ProcessExecutionError>)
  })

  test('passes arguments literally instead of evaluating shell syntax', async () => {
    const shellSyntax = '$(printf injected); semicolon; *'
    await expect(
      exec(
        process.execPath,
        ['-e', 'process.stdout.write(process.argv[1])', shellSyntax],
        {},
      ),
    ).resolves.toBe(shellSyntax)
  })

  test('kills descendants when a command times out', async () => {
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'package-build-stats-exec-'),
    )
    const pidFile = path.join(temporaryDirectory, 'child.pid')
    let descendantPid: number | undefined

    try {
      const command = `sleep 30 & echo $! > "${pidFile}"; wait`
      const startedAt = performance.now()

      await expect(exec('sh', ['-c', command], {}, 100)).rejects.toThrow(
        'cancelled as it exceeded a timeout',
      )

      expect(performance.now() - startedAt).toBeLessThan(750)

      descendantPid = Number(await fs.readFile(pidFile, 'utf8'))

      expect(await waitForProcessToExit(descendantPid, 1000)).toBe(true)
    } finally {
      if (descendantPid && isProcessRunning(descendantPid)) {
        process.kill(descendantPid, 'SIGKILL')
      }
      await fs.rm(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
