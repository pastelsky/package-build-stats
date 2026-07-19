import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import InstallationUtils from '../../src/utils/installation.utils.js'

describe('InstallationUtils', () => {
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
        { client: 'npm', isLocal: true, installTimeout: 10_000 },
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

  test('throws instead of terminating the host for an invalid client', async () => {
    await expect(
      InstallationUtils.installWithClient(
        'example',
        '/tmp/unused',
        {},
        'invalid' as 'npm',
      ),
    ).rejects.toThrow('Unsupported package manager: invalid')
  })
})
