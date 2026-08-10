import { afterEach, describe, expect, test, vi } from 'vitest'
import { BuildCancelledError } from '../../src/errors/CustomError'

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

  test('closes the compiler and preserves an error returned without stats', async () => {
    const runError = new Error('compile failed')
    const close = vi.fn(callback => callback())

    mockRspack.mockReturnValue({
      run: (callback: (error: Error, stats?: never) => void) =>
        callback(runError),
      close,
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
    ).rejects.toBe(runError)
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('preserves the build error when compiler cleanup also fails', async () => {
    const runError = new Error('compile failed')
    const closeError = new Error('close failed')

    mockRspack.mockReturnValue({
      run: (callback: (error: Error, stats?: never) => void) =>
        callback(runError),
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
    ).rejects.toBe(runError)
  })

  test('does not start rspack when its signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    expect(() =>
      BuildUtils.compilePackage({
        name: 'demo-package',
        entry: { main: '/tmp/index.js' },
        externals: {
          externalPackages: [],
          externalBuiltIns: [],
        },
        signal: controller.signal,
      }),
    ).toThrow(BuildCancelledError)
    expect(mockRspack).not.toHaveBeenCalled()
  })

  test('rejects an aborted compile after closing the compiler', async () => {
    const controller = new AbortController()
    const close = vi.fn(callback => callback())
    let finishCompile: ((error: null, stats: any) => void) | undefined

    mockRspack.mockReturnValue({
      run: (callback: (error: null, stats: any) => void) => {
        finishCompile = callback
      },
      close,
    })

    const compilation = BuildUtils.compilePackage({
      name: 'demo-package',
      entry: { main: '/tmp/index.js' },
      externals: {
        externalPackages: [],
        externalBuiltIns: [],
      },
      signal: controller.signal,
    })

    controller.abort()
    finishCompile?.(null, { compilation: { errors: [] } })

    await expect(compilation).rejects.toBeInstanceOf(BuildCancelledError)
    expect(close).toHaveBeenCalledTimes(1)
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

  test('parseMissingModules extracts missing packages across multiple error patterns', () => {
    const compilationErrors = [
      { message: "Module parse failed: Unexpected character '#'" },
      { message: "Can't resolve 'lodash' in '/tmp/project'" },
      { message: "Cannot find module '@babel/core'" },
      { message: 'Could not resolve "express"' },
      { message: 'Failed to resolve import "axios"' },
    ]

    const missing = BuildUtils.parseMissingModules(compilationErrors)
    expect(missing).toEqual(['lodash', '@babel/core', 'express', 'axios'])
  })

  test('parseMissingModules returns empty array for non-missing-module compilation errors', () => {
    const compilationErrors = [
      { message: "Module parse failed: Unexpected character '#'" },
      { message: 'JavaScript parse error: Expression expected' },
    ]

    const missing = BuildUtils.parseMissingModules(compilationErrors)
    expect(missing).toEqual([])
  })
})
