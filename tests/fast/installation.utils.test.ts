import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'

import {
  BuildCancelledError,
  InstallError,
  PackageNotFoundError,
  UnsupportedPackageError,
} from '../../src/errors/CustomError.js'
import { exec, ProcessExecutionError } from '../../src/utils/common.utils.js'
import InstallationUtils from '../../src/utils/installation.utils.js'

function makeProcessError(stderr: string, stdout = '') {
  return new ProcessExecutionError('install failed', stdout, stderr, 1)
}

// The local-package integration test (npm-pack + real install) lives in
// tests/slow/local.test.ts – exec is mocked for the whole file below.

describe('InstallationUtils', () => {
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

  test.each([
    Object.assign(new Error('write failed'), { code: 'ENOSPC' }),
    makeProcessError('ENOSPC writing package'),
    makeProcessError('', 'no space left on device'),
    new InstallError('ENOSPC: could not extract tarball'),
  ])(
    'does not try another package manager after disk exhaustion: %s',
    async original => {
      const error = new InstallError(original)
      const install = vi
        .spyOn(InstallationUtils, 'installWithClient')
        .mockRejectedValue(error)
      try {
        await expect(
          InstallationUtils.installPackage('example', '/tmp/unused', {}),
        ).rejects.toBe(error)
        expect(install).toHaveBeenCalledTimes(1)
      } finally {
        install.mockRestore()
      }
    },
  )

  test('still falls back from Bun to npm for an ordinary install failure', async () => {
    const install = vi
      .spyOn(InstallationUtils, 'installWithClient')
      .mockRejectedValueOnce(
        new InstallError(new Error('unsupported lockfile')),
      )
      .mockResolvedValueOnce(undefined)
    try {
      await InstallationUtils.installPackage('example', '/tmp/unused', {})
      expect(install.mock.calls.map(call => call[3])).toEqual(['bun', 'npm'])
    } finally {
      install.mockRestore()
    }
  })

  test('does not try a fallback package manager after cancellation', async () => {
    const installWithClient = vi
      .spyOn(InstallationUtils, 'installWithClient')
      .mockRejectedValue(new BuildCancelledError())

    try {
      await expect(
        InstallationUtils.installPackage('example', '/tmp/unused', {
          client: ['bun', 'npm'],
        }),
      ).rejects.toBeInstanceOf(BuildCancelledError)

      expect(installWithClient).toHaveBeenCalledTimes(1)
      expect(installWithClient).toHaveBeenCalledWith(
        'example',
        '/tmp/unused',
        expect.objectContaining({ client: 'bun' }),
        'bun',
      )
    } finally {
      installWithClient.mockRestore()
    }
  })
})

// vi.mock is hoisted by Vitest, so exec is replaced for the whole file.
vi.mock('../../src/utils/common.utils.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/utils/common.utils.js')>()
  return {
    ...actual,
    exec: vi.fn(),
  }
})

describe('installWithClient – package-not-found error classification', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  const cases: Array<{
    pm: 'npm' | 'yarn' | 'pnpm' | 'bun'
    label: string
    stderr: string
    stdout?: string
  }> = [
    {
      pm: 'npm',
      label: 'npm E404 (unknown package)',
      stderr:
        'npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/no-such-pkg',
    },
    {
      pm: 'npm',
      label: 'npm ETARGET (version range has no match)',
      stderr:
        'npm error code ETARGET\nnpm error notarget No matching version found for lodash@999.0.0',
    },
    {
      pm: 'npm',
      label: 'npm "No matching version found" text',
      stderr:
        'npm ERR! code ETARGET\nnpm ERR! No matching version found for react@0.0.0-nonexistent.',
    },
    {
      pm: 'npm',
      label: 'npm ENOVERSIONS (dependency has no published versions)',
      stderr:
        'npm error code ENOVERSIONS\nnpm error No versions available for fb-chat-support',
    },
    {
      pm: 'yarn',
      label: "yarn classic – Couldn't find package",
      stderr:
        'error Couldn\'t find package "no-such-pkg" on the "npm" registry',
    },
    {
      pm: 'yarn',
      label: 'yarn berry – YN0035',
      stderr:
        "YN0035: │ no-such-pkg@npm:^1.0.0 couldn't be resolved to a satisfying range",
    },
    {
      pm: 'pnpm',
      label: 'pnpm ERR_PNPM_NO_MATCHING_VERSION',
      stderr:
        'ERR_PNPM_NO_MATCHING_VERSION  No matching version found for no-such-pkg@999.0.0',
    },
    {
      pm: 'pnpm',
      label: 'pnpm ERR_PNPM_FETCH_404',
      stderr:
        'ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/no-such-pkg: Not Found - 404',
    },
    {
      pm: 'bun',
      label: 'bun – package not found',
      stderr: 'error: bun package not found no-such-pkg',
    },
    {
      pm: 'bun',
      label: 'bun – 404 Not Found',
      stderr:
        '404 Not Found\nGET https://registry.npmjs.org/no-such-pkg/-/no-such-pkg-1.0.0.tgz',
    },
  ]

  for (const { pm, label, stderr, stdout = '' } of cases) {
    test(`throws PackageNotFoundError for: ${label}`, async () => {
      vi.mocked(exec).mockRejectedValue(makeProcessError(stderr, stdout))

      await expect(
        InstallationUtils.installWithClient(
          'no-such-pkg@999.0.0',
          '/tmp/unused-install-path',
          { client: pm },
          pm,
        ),
      ).rejects.toBeInstanceOf(PackageNotFoundError)
    })
  }

  test('throws InstallError for generic (non-404) failures', async () => {
    vi.mocked(exec).mockRejectedValue(
      makeProcessError('npm ERR! network timeout', ''),
    )

    await expect(
      InstallationUtils.installWithClient(
        'some-pkg',
        '/tmp/unused-install-path',
        { client: 'npm' },
        'npm',
      ),
    ).rejects.toBeInstanceOf(InstallError)
  })
})

describe('installWithClient – unsupported package error classification', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  const cases: Array<{
    pm: 'npm' | 'yarn' | 'pnpm' | 'bun'
    label: string
    stderr: string
    stdout?: string
  }> = [
    {
      pm: 'npm',
      label: 'npm EBADPLATFORM (unsupported OS/CPU)',
      stderr:
        'npm error code EBADPLATFORM\nnpm error notsup Unsupported platform for @esbuild/android-arm@0.28.1: wanted {"os":"android","cpu":"arm"} (current: {"os":"darwin","cpu":"arm64"})',
    },
    {
      pm: 'pnpm',
      label: 'pnpm ERR_PNPM_UNSUPPORTED_PLATFORM',
      stderr:
        'ERR_PNPM_UNSUPPORTED_PLATFORM  Unsupported platform for @esbuild/android-arm: wanted {"os":"android"}',
    },
    {
      pm: 'bun',
      label: 'bun unsupported architecture',
      stderr:
        'error: unsupported architecture arm64 for @esbuild/android-arm@0.28.1',
    },
    {
      pm: 'npm',
      label: 'Git SSH permission denied (publickey)',
      stderr:
        'npm error code 128\nnpm error An unknown git error occurred\nnpm error command git --no-replace-objects ls-remote ssh://git@github.com/org/repo.git\nnpm error git@github.com: Permission denied (publickey).',
    },
  ]

  for (const { pm, label, stderr, stdout = '' } of cases) {
    test(`throws UnsupportedPackageError for: ${label}`, async () => {
      vi.mocked(exec).mockRejectedValue(makeProcessError(stderr, stdout))

      await expect(
        InstallationUtils.installWithClient(
          'unsupported-pkg',
          '/tmp/unused-install-path',
          { client: pm },
          pm,
        ),
      ).rejects.toBeInstanceOf(UnsupportedPackageError)
    })
  }
})

test('falls back when Bun succeeds without installing an incompatible package', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skipped-install-'))
  vi.mocked(exec)
    .mockResolvedValueOnce('')
    .mockRejectedValueOnce(
      makeProcessError('npm error code EBADPLATFORM\nUnsupported platform'),
    )
  try {
    await expect(
      InstallationUtils.installPackage('platform-binary@1.0.0', root, {}),
    ).rejects.toBeInstanceOf(UnsupportedPackageError)
    expect(vi.mocked(exec).mock.calls.map(call => call[0])).toEqual([
      'bun',
      'npm',
    ])
  } finally {
    vi.mocked(exec).mockReset()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('accepts a successful install when the requested manifest exists', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'valid-install-'))
  const installed = path.join(root, 'node_modules', '@scope', 'example')
  await fs.mkdir(installed, { recursive: true })
  await fs.writeFile(path.join(installed, 'package.json'), '{}')
  vi.mocked(exec).mockResolvedValueOnce('')
  try {
    await InstallationUtils.installPackage('@scope/example@1.0.0', root, {})
    expect(exec).toHaveBeenCalledTimes(1)
  } finally {
    vi.mocked(exec).mockReset()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test.each(['workspace:*', 'link:../private-package', 'yarn:private-package@1'])(
  'classifies unsupported dependency protocol %s',
  async specifier => {
    vi.mocked(exec).mockRejectedValueOnce(
      makeProcessError(
        `npm error code EUNSUPPORTEDPROTOCOL\nnpm error Unsupported URL Type "${specifier.split(':')[0]}:": ${specifier}`,
      ),
    )
    try {
      await expect(
        InstallationUtils.installWithClient(
          'broken-workspace@1.0.0',
          '/unused',
          {},
          'npm',
        ),
      ).rejects.toBeInstanceOf(UnsupportedPackageError)
    } finally {
      vi.mocked(exec).mockReset()
    }
  },
)
