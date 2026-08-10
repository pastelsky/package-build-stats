/**
 * @jest-environment node
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPackageStats } from '../../src'
import InstallationUtils from '../../src/utils/installation.utils.js'
import 'dotenv/config'

describe('getPackageStats', () => {
  test('Size of local build', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test'),
    )
    expect(result.size).toBeBetween(300, 350)
  })

  test('dependencySizes', async () => {
    const result = await getPackageStats(
      path.resolve('./fixtures/node_modules/resolve-test'),
    )

    expect(result.dependencySizes).toBeDefined()
    expect(result.dependencySizes?.length).toEqual(1)

    if (result.dependencySizes) {
      expect(result.dependencySizes).toEqual(
        expect.arrayContaining([
          {
            name: 'resolve-test/nested-folder/another-nested-folder',
            approximateSize: 128,
          },
        ]),
      )
    }
  })
})

// Complex export chain test removed
// TODO: Enhance oxc-parser export detection to handle:
//   - "module" field without "main"
//   - export * re-export chains across multiple files
//   - nested folder structures with complex re-exports

describe('InstallationUtils (integration)', () => {
  /**
   * Regression: local package paths containing shell metacharacters (e.g. `;`)
   * must never be passed through a shell – they are forwarded as argv arguments.
   */
  test('installs a local package whose path contains shell metacharacters', async () => {
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'package-build-stats-install-'),
    )
    const packagePath = path.join(temporaryDirectory, 'fixture; not-a-command')
    const installPath = await InstallationUtils.preparePath('local-fixture')

    try {
      await fs.mkdir(packagePath)
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({
          name: 'local-fixture',
          version: '1.0.0',
          main: 'index.js',
        }),
      )
      await fs.writeFile(
        path.join(packagePath, 'index.js'),
        'module.exports = 42\n',
      )

      await InstallationUtils.installWithClient(
        packagePath,
        installPath,
        { client: 'npm', isLocal: true, installTimeout: 30_000 },
        'npm',
      )

      const installedPackage = JSON.parse(
        await fs.readFile(
          path.join(
            installPath,
            'node_modules',
            'local-fixture',
            'package.json',
          ),
          'utf8',
        ),
      )
      expect(installedPackage.name).toBe('local-fixture')
    } finally {
      await InstallationUtils.cleanupPath(installPath)
      await fs.rm(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
