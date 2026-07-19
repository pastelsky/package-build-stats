import { beforeEach, describe, expect, it, vi } from 'vitest'

const { minifyMock } = vi.hoisted(() => ({
  minifyMock: vi.fn(),
}))

vi.mock('oxc-minify', () => ({
  minify: minifyMock,
}))

import getDependencySizeTree from '../../src/getDependencySizeTree'

type RspackStatsCompilation = Parameters<typeof getDependencySizeTree>[1]

describe('getDependencySizeTree - Oxc concurrency', () => {
  beforeEach(() => {
    minifyMock.mockReset()
  })

  it('limits native minification to four modules at a time', async () => {
    let active = 0
    let maxActive = 0

    minifyMock.mockImplementation(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 10))
      active -= 1

      return { code: 'x', errors: [] }
    })

    const modules = Array.from({ length: 12 }, (_, index) => {
      const packageIndex = Math.floor(index / 4)
      return {
        identifier: `/project/node_modules/test-package-${packageIndex}/file-${index}.js`,
        moduleType: 'javascript/esm',
        source: `export const value${index} = ${index}`,
      }
    })

    const result = await getDependencySizeTree('fixture-pkg', {
      modules,
    } as unknown as RspackStatsCompilation)

    expect(result).toEqual([
      { name: 'test-package-0', approximateSize: 4 },
      { name: 'test-package-1', approximateSize: 4 },
      { name: 'test-package-2', approximateSize: 4 },
    ])
    expect(minifyMock).toHaveBeenCalledTimes(12)
    expect(maxActive).toBe(4)
    expect(minifyMock).toHaveBeenCalledWith(
      'test-package-0-0.js',
      'export const value0 = 0',
      { compress: true, mangle: true, module: true },
    )
  })
})
