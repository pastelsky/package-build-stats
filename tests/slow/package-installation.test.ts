import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getAllPackageExports,
  getPackageExportSizes,
  getPackageStats,
} from '../../src/index.js'
import { disposePackage, installPackage } from '../../src/installation.js'
import InstallationUtils from '../../src/utils/installation.utils.js'

const fixturePath = path.resolve(__dirname, '../fixtures/exports/multi-exports')

describe('package installation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('uses one installation with independent leases and build paths', async () => {
    const installation = await installPackage(fixturePath)
    const localInstall = vi.spyOn(InstallationUtils, 'installPackage')
    const buildPath = vi.spyOn(InstallationUtils, 'prepareBuildPath')
    const release = vi.fn(async () => {})
    const installationProvider = vi.fn(async () => {
      return {
        ...installation,
        release,
      }
    })

    try {
      const options = { installationProvider }
      const [stats, exports, exportSizes] = await Promise.all([
        getPackageStats(fixturePath, options),
        getAllPackageExports(fixturePath, options),
        getPackageExportSizes(fixturePath, options),
      ])

      expect(stats.size).toBeGreaterThan(0)
      expect(Object.keys(exports).length).toBeGreaterThan(0)
      expect(exportSizes.assets.length).toBeGreaterThan(0)
      expect(localInstall).not.toHaveBeenCalled()
      expect(installationProvider).toHaveBeenCalledTimes(3)
      expect(release).toHaveBeenCalledTimes(3)
      expect(buildPath).toHaveBeenCalledTimes(2)
      const artifactPaths = await Promise.all(
        buildPath.mock.results.map(result => result.value),
      )
      expect(new Set(artifactPaths).size).toBe(2)
      expect(artifactPaths).not.toContain(installation.installPath)
    } finally {
      await disposePackage(installation)
    }
  })

  test('installs locally by default but does not fall back after provider failure', async () => {
    const localInstall = vi.spyOn(InstallationUtils, 'installPackage')

    await expect(getPackageStats(fixturePath)).resolves.toMatchObject({
      size: expect.any(Number),
    })
    expect(localInstall).toHaveBeenCalledTimes(1)

    await expect(
      getPackageStats(fixturePath, {
        installationProvider: async () => {
          throw new Error('offline')
        },
      }),
    ).rejects.toThrow('offline')
    expect(localInstall).toHaveBeenCalledTimes(1)
  })
})
