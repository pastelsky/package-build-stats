import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, test } from 'vitest'
import {
  getAllPackageExports,
  getPackageExportSizes,
  getPackageStats,
  getPackageEntryPoints,
} from '../../src/index.js'
import type { InstallationProvider } from '../../src/common.types.js'

const packageName = '@fixture/entry-points'
const packageString = `${packageName}@1.0.0`
let installPath: string
let installationProvider: InstallationProvider

beforeAll(async () => {
  installPath = await mkdtemp(path.join(tmpdir(), 'entry-points-test-'))
  const packagePath = path.join(installPath, 'node_modules', packageName)
  await mkdir(path.dirname(packagePath), { recursive: true })
  await cp(
    fileURLToPath(new URL('../fixtures/entry-points', import.meta.url)),
    packagePath,
    { recursive: true },
  )
  await cp(
    fileURLToPath(new URL('../fixtures/subpath-only', import.meta.url)),
    path.join(installPath, 'node_modules', 'subpath-only'),
    { recursive: true },
  )
  installationProvider = async () => ({
    packageName,
    packageString,
    packagePath,
    installPath,
    async release() {},
  })
})

afterAll(async () => {
  if (installPath) await rm(installPath, { recursive: true, force: true })
})

test('entry-point discovery lists concrete browser paths, not private, blocked, metadata or type-only entries', async () => {
  const entryPoints = await getPackageEntryPoints(packageString, {
    installationProvider,
  })
  expect(entryPoints).toEqual([
    '.',
    './features/index',
    './features/mini',
    './mini',
  ])
  await Promise.all(
    entryPoints.map(async entryPoint => {
      const exports = await getAllPackageExports(packageString, {
        installationProvider,
        entryPoint,
      })
      expect(Object.keys(exports).length).toBeGreaterThan(0)
    }),
  )
})

test('root and subpath sizes measure different public imports of a scoped package', async () => {
  const root = await getPackageStats(packageString, { installationProvider })
  const mini = await getPackageStats(packageString, {
    installationProvider,
    entryPoint: './mini',
  })
  expect(root.size).toBeGreaterThan(mini.size)
  expect(mini.gzip).toBeGreaterThan(0)
})

test('named exports respect the public root and browser conditional subpath', async () => {
  const root = await getAllPackageExports(packageString, {
    installationProvider,
  })
  const mini = await getAllPackageExports(packageString, {
    installationProvider,
    entryPoint: './mini',
  })
  expect(Object.keys(root).sort()).toEqual(['extra', 'full'])
  expect(Object.keys(mini)).toEqual(['mini'])
})

test('per-export sizes use the selected subpath, including named-import size builds', async () => {
  const options = { installationProvider, entryPoint: './mini' }
  const result = await getPackageExportSizes(packageString, options)
  const selected = await getPackageStats(packageString, {
    ...options,
    customImports: ['mini'],
  })
  expect(result.assets).toEqual([
    expect.objectContaining({
      name: 'mini',
      path: 'node_modules/@fixture/entry-points/mini.js',
    }),
  ])
  expect(result.assets[0].size).toBeGreaterThan(0)
  expect(result.assets[0].gzip).toBeGreaterThan(0)
  expect(selected.size).toBeGreaterThan(0)
  expect(selected.gzip).toBeGreaterThan(0)
})

test('concrete wildcard subpaths resolve without treating patterns as import paths', async () => {
  const exports = await getAllPackageExports(packageString, {
    installationProvider,
    entryPoint: './features/mini',
  })
  expect(Object.keys(exports)).toEqual(['mini'])
})

test('packages without a public root can still measure their public subpaths', async () => {
  const provider: InstallationProvider = async () => ({
    packageName: 'subpath-only',
    packageString: 'subpath-only@1.0.0',
    packagePath: path.join(installPath, 'node_modules', 'subpath-only'),
    installPath,
    async release() {},
  })
  const options = { installationProvider: provider, entryPoint: './client' }
  expect(await getPackageEntryPoints('subpath-only@1.0.0', options)).toEqual([
    './client',
  ])
  const stats = await getPackageStats('subpath-only@1.0.0', options)
  const exports = await getAllPackageExports('subpath-only@1.0.0', options)
  expect(stats.size).toBeGreaterThan(0)
  expect(Object.keys(exports)).toEqual(['client'])
  await expect(
    getPackageStats('subpath-only@1.0.0', { installationProvider: provider }),
  ).rejects.toThrow()
})

test.each(['./missing', './blocked', './features/server'])(
  'unavailable entry %s fails instead of returning an empty or root bundle',
  async entryPoint => {
    const options = { installationProvider, entryPoint }
    await expect(getPackageStats(packageString, options)).rejects.toThrow()
    await expect(getAllPackageExports(packageString, options)).rejects.toThrow()
    await expect(
      getPackageExportSizes(packageString, options),
    ).rejects.toThrow()
  },
)

test.each([
  '../mini',
  './a/../mini',
  './features/*',
  '#internal',
  './mini?query',
])('invalid or private entry %s is rejected', async entryPoint => {
  await expect(
    getPackageStats(packageString, { installationProvider, entryPoint }),
  ).rejects.toThrow(TypeError)
})
