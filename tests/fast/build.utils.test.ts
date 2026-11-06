import { afterEach, describe, expect, test, vi } from 'vitest'
import { BuildCancelledError } from '../../src/errors/CustomError'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Stats } from '@rspack/core'

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
    parseWebpackStats: vi.fn(),
    assetsGZIPParseTime: vi.fn(),
  },
}))

const { default: BuildUtils } = await import('../../src/utils/build.utils.js')

test('bounds asset reads across overlapping builds and preserves ordered gzip results', async () => {
  const content = Buffer.from('export const answer = 42')
  const assets = Array.from({ length: 3 }, (_, index) => ({
    name: `asset-${index}.bundle.js`,
    size: content.length,
  }))
  vi.spyOn(BuildUtils, 'createEntryPoint').mockReturnValue('/unused/index.js')
  vi.spyOn(BuildUtils, 'compilePackage').mockResolvedValue({
    error: null,
    stats: {
      compilation: { errors: [] },
      toJson: () => ({ assets }),
    } as unknown as Stats,
  })

  const releases: Array<() => void> = []
  let active = 0
  let peak = 0
  vi.spyOn(fs.promises, 'readFile').mockImplementation(async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise<void>(resolve => releases.push(resolve))
    active--
    return content
  })
  const build = () =>
    BuildUtils.buildPackage({
      name: 'demo-package',
      installPath: path.join('/unused', 'demo-package'),
      externals: { externalPackages: [], externalBuiltIns: [] },
      options: { includeDependencySizes: false },
    })

  try {
    const results = Promise.all([build(), build()])
    await vi.waitFor(() => expect(releases.length).toBeGreaterThanOrEqual(4))
    expect(active).toBe(4)
    releases
      .splice(0)
      .reverse()
      .forEach(release => release())
    await vi.waitFor(() => expect(releases.length).toBeGreaterThanOrEqual(2))
    releases
      .splice(0)
      .reverse()
      .forEach(release => release())
    const expected = assets.map((asset, index) => ({
      name: `asset-${index}`,
      type: 'js',
      size: asset.size,
      gzip: gzipSync(content).length,
    }))
    for (const result of await results) expect(result.assets).toEqual(expected)
    expect(peak).toBe(4)
  } finally {
    releases.splice(0).forEach(release => release())
    vi.restoreAllMocks()
  }
})

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

  test('parseMissingModules extracts missing packages when all errors are missing module errors', () => {
    const compilationErrors = [
      { message: "Can't resolve 'lodash' in '/tmp/project'" },
      { message: "Can't resolve '@babel/core' in '/tmp/project'" },
    ]

    const missing = BuildUtils.parseMissingModules(compilationErrors)
    expect(missing).toEqual(['lodash', '@babel/core'])
  })

  test('parseMissingModules returns empty array when non-missing-module compilation errors are present', () => {
    const compilationErrors = [
      { message: "Module parse failed: Unexpected character '#'" },
      { message: "Can't resolve 'lodash' in '/tmp/project'" },
    ]

    const missing = BuildUtils.parseMissingModules(compilationErrors)
    expect(missing).toEqual([])
  })
})
