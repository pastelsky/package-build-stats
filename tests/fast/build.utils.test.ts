import { afterEach, describe, expect, test, vi } from 'vitest'

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
    vi.restoreAllMocks()
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

describe('BuildUtils.buildPackage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  const buildArgs = {
    name: 'demo-package',
    installPath: '/tmp/demo-package',
    externals: {
      externalPackages: [],
      externalBuiltIns: [],
    },
    options: {
      includeDependencySizes: false,
    },
  }

  test('preserves missing-dependency errors without requiring JSON stats', async () => {
    const compilationError = {
      message: "Can't resolve 'missing-package' in '/tmp/demo-package'",
      toString: () => "Can't resolve 'missing-package' in '/tmp/demo-package'",
    }
    const stats = {
      compilation: { errors: [compilationError] },
      toJson: () => {
        throw new Error('JSON stats should not be needed for a failed build')
      },
    }

    vi.spyOn(BuildUtils, 'createEntryPoint').mockReturnValue('/tmp/index.js')
    vi.spyOn(BuildUtils, 'compilePackage').mockResolvedValue({
      error: null,
      stats: stats as any,
    })

    await expect(BuildUtils.buildPackage(buildArgs)).rejects.toMatchObject({
      name: 'MissingDependencyError',
      missingModules: ['missing-package'],
    })
  })
})
