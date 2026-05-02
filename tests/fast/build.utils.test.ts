import { afterEach, describe, expect, test, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mockRspack = vi.fn()
const mockCompilePackage = vi.fn()

vi.mock('@rspack/core', () => ({
  rspack: mockRspack,
}))

vi.mock('../../src/config/makeRspackConfig.js', () => ({
  default: vi.fn(() => ({ mode: 'production' })),
}))

vi.mock('../../src/utils/telemetry.utils.js', () => ({
  default: {
    compilePackage: mockCompilePackage,
  },
}))

const { default: BuildUtils } = await import('../../src/utils/build.utils.js')

describe('BuildUtils.compilePackage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('closes the rspack compiler before resolving', async () => {
    const close = vi.fn(callback => callback())
    const stats = { compilation: { errors: [] } }

    mockRspack.mockReturnValue({
      run: (callback: (error: Error | null, stats: typeof stats) => void) =>
        callback(null, stats),
      close,
    })

    const result = await BuildUtils.compilePackage({
      name: 'demo-package',
      entry: { main: '/tmp/index.js' },
      externals: {
        externalPackages: [],
        externalBuiltIns: [],
      },
    })

    expect(close).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      error: null,
      stats,
    })
    expect(mockCompilePackage).toHaveBeenCalledWith(
      'demo-package',
      true,
      expect.any(Number),
      {},
    )
  })

  test('rejects when compiler close fails', async () => {
    const closeError = new Error('close failed')

    mockRspack.mockReturnValue({
      run: (callback: (error: Error | null, stats: any) => void) =>
        callback(null, { compilation: { errors: [] } }),
      close: (callback: (error: Error) => void) => callback(closeError),
    })

    await expect(
      BuildUtils.compilePackage({
        name: 'demo-package',
        entry: { main: '/tmp/index.js' },
        externals: {
          externalPackages: [],
          externalBuiltIns: [],
        },
      }),
    ).rejects.toThrow('close failed')
  })
})

describe('BuildUtils.createEntryPoint', () => {
  test('aliases reserved export names in ESM import statements', () => {
    const installPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'pbs-entrypoint-test-'),
    )

    try {
      const entryPath = BuildUtils.createEntryPoint('zod', installPath, {
        esm: true,
        customImports: ['enum', 'void', 'function'],
        entryFilename: 'reserved.js',
      })

      const contents = fs.readFileSync(entryPath, 'utf8')

      expect(contents).toContain(
        'import { "enum" as __bp_import_0, "void" as __bp_import_1, "function" as __bp_import_2 } from \'zod\';',
      )
      expect(contents).toContain(
        'console.log(__bp_import_0, __bp_import_1, __bp_import_2)',
      )
    } finally {
      fs.rmSync(installPath, { recursive: true, force: true })
    }
  })
})
