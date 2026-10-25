import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { performance } from 'node:perf_hooks'
import Telemetry from '../../src/utils/telemetry.utils.js'
import {
  getPackageEntryPoints,
  getAllPackageExports,
  getPackageStats,
} from '../../src/index.js'
import type { InstallationProvider } from '../../src/common.types.js'

const cases = [
  { fixture: 'jsx-in-js', entries: ['.'], entryPoint: '.', exports: ['Tilt'] },
  {
    fixture: 'svelte-modern',
    entries: ['.'],
    entryPoint: '.',
    exports: null,
  },
  {
    fixture: 'svelte-legacy',
    entries: ['.'],
    entryPoint: '.',
    exports: null,
  },
  {
    fixture: 'vue-conditions',
    entries: ['.'],
    entryPoint: '.',
    exports: ['createApp', 'ref'],
  },
  {
    fixture: 'private-imports',
    entries: ['.', './server'],
    entryPoint: './server',
    exports: ['environment'],
  },
  {
    fixture: 'pattern-specificity',
    entries: ['./features/public', './features/special', './pair/en'],
    entryPoint: './features/special',
    exports: ['specialFeature'],
  },
  {
    fixture: 'array-root',
    entries: ['.'],
    entryPoint: '.',
    exports: ['arrayRuntime'],
  },
  { fixture: 'css-style', entries: ['.'], entryPoint: '.', exports: null },
] as const
let installPath: string

beforeAll(async () => {
  installPath = await mkdtemp(path.join(tmpdir(), 'entry-point-compatibility-'))
  await mkdir(path.join(installPath, 'node_modules'))
  await Promise.all(
    cases.map(async ({ fixture }) => {
      await cp(
        fileURLToPath(
          new URL(
            `../fixtures/entry-point-compatibility/${fixture}`,
            import.meta.url,
          ),
        ),
        path.join(installPath, 'node_modules', `entrypoint-${fixture}`),
        { recursive: true },
      )
    }),
  )
})

afterAll(async () => {
  if (installPath) await rm(installPath, { recursive: true, force: true })
})

test.each(cases)(
  '$fixture: discovered entry points resolve and build with the expected semantics',
  async scenario => {
    const packageName = `entrypoint-${scenario.fixture}`
    const packageString = `${packageName}@1.0.0`
    const installationProvider: InstallationProvider = async () => ({
      packageName,
      packageString,
      installPath,
      packagePath: path.join(installPath, 'node_modules', packageName),
      async release() {},
    })
    expect(
      await getPackageEntryPoints(packageString, { installationProvider }),
    ).toEqual(scenario.entries)
    const options = { installationProvider, entryPoint: scenario.entryPoint }
    const stats = await getPackageStats(packageString, options)
    expect(stats.size).toBeGreaterThan(0)
    expect(stats.gzip).toBeGreaterThan(0)
    if (scenario.exports) {
      const exports = await getAllPackageExports(packageString, options)
      expect(Object.keys(exports).sort()).toEqual([...scenario.exports].sort())
      if (scenario.fixture === 'private-imports')
        expect(exports.environment).toMatch(/browser\.js$/)
    } else if (scenario.fixture === 'css-style') {
      expect(stats.assets).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'css' })]),
      )
    }
  },
)

// The helper accepts a start timestamp, not an already elapsed duration.
test.each([false, true])(
  'stats telemetry uses its start timestamp (failure=%s)',
  async fail => {
    const telemetry = vi.spyOn(Telemetry, 'packageStats')
    const started = performance.now()
    try {
      const result = getPackageStats('entrypoint-array-root@1.0.0', {
        installationProvider: async () => {
          if (fail) throw new Error('installation failed')
          return {
            packageName: 'entrypoint-array-root',
            packageString: 'entrypoint-array-root@1.0.0',
            installPath,
            packagePath: path.join(
              installPath,
              'node_modules/entrypoint-array-root',
            ),
            async release() {},
          }
        },
      })
      if (fail) await expect(result).rejects.toThrow('installation failed')
      else await result
      const call = telemetry.mock.calls[0]
      expect(call[1]).toBe(!fail)
      expect(call[2]).toBeGreaterThanOrEqual(started)
      expect(call[2]).toBeLessThanOrEqual(performance.now())
    } finally {
      telemetry.mockRestore()
    }
  },
)
