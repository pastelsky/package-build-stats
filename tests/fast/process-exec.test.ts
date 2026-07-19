import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { exec } from '../../src/utils/common.utils'

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
    await expect(exec(`printf 'completed'`, {})).resolves.toBe('completed')
  })

  test('returns stderr for a failed command', async () => {
    await expect(exec(`printf 'failed' >&2; exit 1`, {})).rejects.toBe('failed')
  })

  test('kills descendants when a command times out', async () => {
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'package-build-stats-exec-'),
    )
    const pidFile = path.join(temporaryDirectory, 'child.pid')
    let descendantPid: number | undefined

    try {
      const command = `sh -c 'sleep 30 & echo $! > "${pidFile}"; wait'`
      const startedAt = performance.now()

      await expect(exec(command, {}, 100)).rejects.toContain(
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
