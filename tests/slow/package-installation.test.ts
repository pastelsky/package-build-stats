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
    vi.unstubAllGlobals()
  })

  test('shares a service installation across all analysis APIs', async () => {
    const installation = await installPackage(fixturePath)
    const localInstall = vi.spyOn(InstallationUtils, 'installPackage')
    const buildPath = vi.spyOn(InstallationUtils, 'prepareBuildPath')
    const fetchMock = vi.fn(async () => Response.json(installation))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const options = {
        installationService: { url: 'http://installation-service.test' },
      }
      const [stats, exports, exportSizes] = await Promise.all([
        getPackageStats(fixturePath, options),
        getAllPackageExports(fixturePath, options),
        getPackageExportSizes(fixturePath, options),
      ])

      expect(stats.size).toBeGreaterThan(0)
      expect(Object.keys(exports).length).toBeGreaterThan(0)
      expect(exportSizes.assets.length).toBeGreaterThan(0)
      expect(localInstall).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(
        'http://installation-service.test/installations',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(fetchMock).toHaveBeenCalledTimes(3)
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

  test('falls back locally unless the installation service is required', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const localInstall = vi.spyOn(InstallationUtils, 'installPackage')

    await expect(
      getPackageStats(fixturePath, {
        installationService: { url: 'http://installation-service.test' },
      }),
    ).resolves.toMatchObject({ size: expect.any(Number) })
    expect(localInstall).toHaveBeenCalledTimes(1)

    await expect(
      getPackageStats(fixturePath, {
        installationService: {
          url: 'http://installation-service.test',
          fallbackToLocal: false,
        },
      }),
    ).rejects.toThrow('Installation service is unavailable')
    expect(localInstall).toHaveBeenCalledTimes(1)
  })
})
