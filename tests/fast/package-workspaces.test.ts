import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { preparePackage } from '../../src/packageInstallation.js'
import config from '../../src/config/config.js'
import InstallationUtils from '../../src/utils/installation.utils.js'

describe('shared-installation build workspaces', () => {
  afterEach(() => vi.restoreAllMocks())

  test('keeps isolated output in the host-managed packages tree and releases only its own files', async () => {
    const installPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'shared-install-'),
    )
    const release = vi.fn(async () => {})
    const installationProvider = async () => ({
      packageString: 'example@1.0.0',
      packageName: 'example',
      installPath,
      packagePath: path.join(installPath, 'node_modules/example'),
      release,
    })
    const prepared: Awaited<ReturnType<typeof preparePackage>>[] = []

    try {
      await fs.writeFile(path.join(installPath, 'keep'), 'shared installation')
      // Both analyses lease the same installation, but must never share output.
      await Promise.all(
        Array.from({ length: 2 }, async () => {
          prepared.push(
            await preparePackage('example@1.0.0', { installationProvider }),
          )
        }),
      )
      expect(new Set(prepared.map(entry => entry.buildPath)).size).toBe(2)
      await Promise.all(
        prepared.map(async entry => {
          expect(path.dirname(entry.buildPath)).toBe(
            path.join(config.tmp, 'packages'),
          )
          expect(entry.buildPath).not.toBe(installPath)
          await fs.writeFile(
            path.join(entry.buildPath, 'output.js'),
            'generated',
          )
          await entry.cleanup()
          await expect(fs.access(entry.buildPath)).rejects.toMatchObject({
            code: 'ENOENT',
          })
        }),
      )
      await expect(
        fs.readFile(path.join(installPath, 'keep'), 'utf8'),
      ).resolves.toBe('shared installation')
      expect(release).toHaveBeenCalledTimes(2)
    } finally {
      await Promise.all(
        prepared.map(entry =>
          fs.rm(entry.buildPath, { recursive: true, force: true }),
        ),
      )
      await fs.rm(installPath, { recursive: true, force: true })
    }
  })

  test('releases the installation if cancellation prevents workspace creation', async () => {
    const controller = new AbortController()
    const release = vi.fn(async () => {})
    const createWorkspace = vi.spyOn(InstallationUtils, 'getInstallPath')

    await expect(
      preparePackage('example@1.0.0', {
        signal: controller.signal,
        installationProvider: async () => {
          controller.abort()
          return {
            packageString: 'example@1.0.0',
            packageName: 'example',
            installPath: '/unused/shared-install',
            packagePath: '/unused/shared-install/node_modules/example',
            release,
          }
        },
      }),
    ).rejects.toMatchObject({ name: 'BuildCancelledError' })
    expect(createWorkspace).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledOnce()
  })
})
