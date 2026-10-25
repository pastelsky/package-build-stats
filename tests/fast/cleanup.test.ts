import path from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import {
  disposePackage,
  installPackage,
  preparePackage,
} from '../../src/packageInstallation.js'
import InstallationUtils from '../../src/utils/installation.utils.js'

const installation = {
  packageString: 'example@1.0.0',
  packageName: 'example',
  installPath: '/unused/installation',
  packagePath: '/unused/installation/node_modules/example',
}

afterEach(() => vi.restoreAllMocks())

test('delegates owned workspace removal and still releases a borrowed installation', async () => {
  vi.spyOn(InstallationUtils, 'prepareBuildPath').mockResolvedValue(
    '/unused/build',
  )
  const cleanup = vi.fn(async () => {})
  const release = vi.fn(async () => {})
  const prepared = await preparePackage(installation.packageString, {
    cleanup,
    installationProvider: async () => ({ ...installation, release }),
  })
  await prepared.cleanup()
  expect(cleanup).toHaveBeenCalledExactlyOnceWith('/unused/build')
  expect(release).toHaveBeenCalledOnce()
})

test('cleanup failure does not replace the result or prevent lease release', async () => {
  vi.spyOn(InstallationUtils, 'prepareBuildPath').mockResolvedValue(
    '/unused/build',
  )
  const error = new Error('cleanup failed')
  const cleanup = vi.fn().mockRejectedValue(error)
  const release = vi.fn(async () => {})
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  const prepared = await preparePackage(installation.packageString, {
    cleanup,
    installationProvider: async () => ({ ...installation, release }),
  })
  await expect(prepared.cleanup()).resolves.toBeUndefined()
  expect(cleanup).toHaveBeenCalledOnce()
  expect(release).toHaveBeenCalledOnce()
  expect(logged).toHaveBeenCalledWith(
    expect.any(String),
    '/unused/build',
    expect.any(String),
    error,
  )
})

test('cleans failed installations through the callback and preserves the install error', async () => {
  vi.spyOn(InstallationUtils, 'preparePath').mockResolvedValue(
    installation.installPath,
  )
  const error = new Error('install failed')
  vi.spyOn(InstallationUtils, 'installPackage').mockRejectedValue(error)
  const cleanup = vi.fn(async () => {})
  await expect(
    installPackage(installation.packageString, { cleanup }),
  ).rejects.toBe(error)
  expect(cleanup).toHaveBeenCalledExactlyOnceWith(installation.installPath)
})

test('explicit disposal uses the callback; debug retention keeps the workspace', async () => {
  const cleanup = vi.fn(async () => {})
  await disposePackage(installation, { cleanup })
  expect(cleanup).toHaveBeenCalledExactlyOnceWith(installation.installPath)
  cleanup.mockClear()
  vi.spyOn(InstallationUtils, 'preparePath').mockResolvedValue(
    installation.installPath,
  )
  vi.spyOn(InstallationUtils, 'installPackage').mockResolvedValue('bun')
  const prepared = await preparePackage(installation.packageString, {
    cleanup,
  })
  expect(prepared.client).toBe('bun')
  await prepared.cleanup(true)
  expect(cleanup).not.toHaveBeenCalled()
  await prepared.cleanup()
  expect(cleanup).toHaveBeenCalledExactlyOnceWith(installation.installPath)
})

test('refuses filesystem roots before invoking a custom cleanup', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const cleanup = vi.fn(async () => {})
  await InstallationUtils.cleanupPath(path.parse(process.cwd()).root, cleanup)
  expect(cleanup).not.toHaveBeenCalled()
})
