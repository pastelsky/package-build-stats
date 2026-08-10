import { vi } from 'vitest'

import {
  BuildCancelledError,
  InstallError,
  PackageNotFoundError,
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
