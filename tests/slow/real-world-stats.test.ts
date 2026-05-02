import { getPackageStats } from '../../src'
import pSeries from 'p-series'
import 'dotenv/config'

const MAX_SIZE_DELTA = 7 * 1024 // in bytes
const MIN_SIZE_DELTA = 3 * 1024 // in bytes

const isDeltaOk = (originalSize: number, builtSize: number): boolean => {
  const diff = Math.abs(originalSize - builtSize)

  if (diff > MAX_SIZE_DELTA) {
    return false
  }

  if (diff < MIN_SIZE_DELTA) {
    return true
  }

  return diff / originalSize < 0.05
}

const UIPackages = [
  {
    name: 'react@15.6.1',
    size: 22.18 * 1024,
  },
  {
    name: 'react@16.0.0-beta.5',
    size: 6.73 * 1024,
  },
  {
    name: 'preact@8.2.5',
    size: 8.28 * 1024,
  },
  {
    name: 'vue@2.4.2',
    size: 58.4 * 1024,
  },
  //  {
  //  name: '@cycle/dom@18.3.0',
  //  size: 56.33 * 1024
  //}
]

const popularPackages = [
  // {
  //   name: 'lodash@4.17.4',
  //   size: 72.77 * 1024
  // },
  {
    name: 'async@2.5.0',
    size: 23.74 * 1024,
  },
  {
    name: 'bluebird@3.5.0',
    size: 75.65 * 1024,
  },
  {
    name: 'jquery@3.2.1',
    size: 86.66 * 1024,
  },
  // {
  //  name: 'rxjs@5.4.3',
  //  size: 141.32 * 1024
  // },
  {
    name: 'moment@2.18.1',
    size: 240 * 1024,
  },
  {
    name: 'redux@3.7.2',
    size: 5.76 * 1024,
  },
  {
    name: 'axios@0.16.2',
    size: 12.67 * 1024,
  },
]

const UILibraries = [
  {
    name: 'bootstrap@3.3.7',
    size: 37.05 * 1024,
  },
  {
    name: 'animate.css@3.5.2',
    size: 52.79 * 1024,
  },
  {
    name: 'bulma@0.5.1',
    size: 125 * 1024,
  },
  {
    name: 'tachyons@4.8.1',
    size: 80.69 * 1024,
  },
]

const libsWithPeerDeps = [
  {
    name: 'react-dom@15.6.1',
    size: 127 * 1024,
  },
  {
    name: 'react-redux@5.0.6',
    size: 12.81 * 1024,
  },
]

const modernEntrypointPatternPackages = [
  // No exports (legacy/main-driven package)
  { name: 'lodash@4.17.21', pattern: 'no-exports' },
  // Exports only (no main/module)
  { name: 'got@14.4.9', pattern: 'exports-only' },
  // Exports + main only
  { name: 'react@19.2.0', pattern: 'exports+main' },
  // Exports + module only
  { name: 'nuqs@2.8.1', pattern: 'exports+module' },
  // Exports + main + module
  { name: 'zod@4.1.12', pattern: 'exports+main+module' },
]

expect.extend({
  toBeWithinDeltaOf(original, comparison, name) {
    return {
      pass: isDeltaOk(original, comparison),
      message: () =>
        `Size delta too large, EXPECTED: ${comparison}, GOT: ${original}, DIFF: ${
          original - comparison
        }, FOR: ${name}`,
    }
  },
})

describe('real world stats', () => {
  const testPackages = async packages => {
    const promises = packages.map(pack => async () => {
      const res = await getPackageStats(pack.name)
      expect(res.size).toBeWithinDeltaOf(pack.size, pack.name)
    })

    await pSeries(promises)
  }

  test('Sizes of popular UI Frameworks', async () => {
    await testPackages(UIPackages)
  })

  test('Sizes of popular JS Frameworks', async () => {
    await testPackages(popularPackages)
  })

  test('Sizes of popular UI Libraries', async () => {
    await testPackages(UILibraries)
  })

  test('Sizes of libraries with peer dependencies', async () => {
    await testPackages(libsWithPeerDeps)
  })

  test('Modern entrypoint pattern packages build successfully', async () => {
    const promises = modernEntrypointPatternPackages.map(pack => async () => {
      const res = await getPackageStats(pack.name)
      expect(res.size).toBeGreaterThan(0)
      expect(res.gzip).toBeGreaterThan(0)
      expect(Array.isArray(res.assets)).toBe(true)
    })

    await pSeries(promises)
  })
})
