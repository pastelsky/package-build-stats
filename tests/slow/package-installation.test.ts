import path from 'node:path'
import fs from 'node:fs/promises'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getAllPackageExports,
  getPackageExportSizes,
  getPackageStats,
  getPackageEntryPoints,
} from '../../src/index.js'
import { disposePackage, installPackage } from '../../src/installation.js'
import InstallationUtils from '../../src/utils/installation.utils.js'
import type { PackageInstallation } from '../../src/common.types.js'

const fixturePath = path.resolve(__dirname, '../fixtures/exports/multi-exports')

describe('package installation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each([
    [fixturePath, undefined],
    [path.resolve(__dirname, '../fixtures/entry-points'), './mini'],
  ])(
    'concurrent discovery and analyses share one cold installation of %s',
    async (fixture, entryPoint) => {
      let installationPromise: Promise<PackageInstallation> | undefined
      const localInstall = vi.spyOn(InstallationUtils, 'installPackage')
      const buildPath = vi.spyOn(InstallationUtils, 'prepareBuildPath')
      const release = vi.fn(async () => {})
      const installationProvider = vi.fn(async () => {
        installationPromise ??= installPackage(fixture)
        return {
          ...(await installationPromise),
          release,
        }
      })

      try {
        const options = { installationProvider }
        const selectedOptions = { ...options, entryPoint }
        const [entries, stats, selectedStats, exports, exportSizes] =
          await Promise.all([
            getPackageEntryPoints(fixture, options),
            getPackageStats(fixture, options),
            getPackageStats(fixture, selectedOptions),
            getAllPackageExports(fixture, selectedOptions),
            getPackageExportSizes(fixture, selectedOptions),
          ])

        expect(stats.size).toBeGreaterThan(0)
        expect(selectedStats.size).toBeGreaterThan(0)
        expect(entries).toContain(entryPoint ?? '.')
        expect(Object.keys(exports).length).toBeGreaterThan(0)
        expect(exportSizes.assets.length).toBeGreaterThan(0)
        expect(localInstall).toHaveBeenCalledTimes(1)
        expect(localInstall.mock.calls[0][0]).toBe(fixture)
        expect(installationProvider).toHaveBeenCalledTimes(5)
        expect(release).toHaveBeenCalledTimes(5)
        expect(buildPath).toHaveBeenCalledTimes(3)
        const artifactPaths = await Promise.all(
          buildPath.mock.results.map(result => result.value),
        )
        expect(new Set(artifactPaths).size).toBe(3)
        const installation = await installationPromise!
        expect(artifactPaths).not.toContain(installation.installPath)
        await expect(
          fs.access(installation.installPath),
        ).resolves.toBeUndefined()
        await expect(
          getPackageStats(fixture, { ...options, entryPoint: './not-present' }),
        ).rejects.toThrow()
        await expect(getPackageEntryPoints(fixture, options)).resolves.toEqual(
          entries,
        )
        expect(localInstall).toHaveBeenCalledTimes(1)
        expect(release).toHaveBeenCalledTimes(7)
      } finally {
        if (installationPromise) await disposePackage(await installationPromise)
      }
    },
  )

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
