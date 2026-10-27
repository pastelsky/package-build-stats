import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { getAllPackageExports, getPackageExportSizes } from '../../src/index.js'
import type { InstallationProvider } from '../../src/common.types.js'

const packageName = 'public-export-semantics'
let installPath: string
let packagePath: string
let expectedExports: string[]
const installationProvider: InstallationProvider = async () => ({
  packageName,
  packageString: packageName,
  installPath,
  packagePath,
  async release() {},
})

beforeAll(async () => {
  installPath = await mkdtemp(path.join(tmpdir(), 'public-export-semantics-'))
  await mkdir(path.join(installPath, 'node_modules'))
  packagePath = path.join(installPath, 'node_modules', packageName)
  await cp(
    fileURLToPath(
      new URL('../fixtures/exports/public-export-semantics', import.meta.url),
    ),
    packagePath,
    { recursive: true },
  )
  const module = await import(
    pathToFileURL(path.join(packagePath, 'index.js')).href
  )
  expectedExports = Object.keys(module).sort()
})

afterAll(async () => {
  if (installPath) await rm(installPath, { recursive: true, force: true })
})

test('discovers the same public exports as Node, preserving namespaces and explicit exports', async () => {
  const exports = await getAllPackageExports(packageName, {
    installationProvider,
  })
  expect(Object.keys(exports).sort()).toEqual(expectedExports)
  expect(exports.Controls).toBe(
    path.join('node_modules', packageName, 'controls.js'),
  )
  expect(exports.named).toBe(path.join('node_modules', packageName, 'index.js'))
})

test('builds export sizes with the original public names, including keywords and non-identifier names', async () => {
  const result = await getPackageExportSizes(packageName, {
    installationProvider,
  })
  expect(result.assets.map(asset => asset.name).sort()).toEqual(expectedExports)
  expect(result.ignoredMissingDependencies).toBeUndefined()
  for (const asset of result.assets) {
    expect(asset.size).toBeGreaterThan(0)
    expect(asset.gzip).toBeGreaterThan(0)
    expect(asset.path).toBeTruthy()
  }
})

test('discovers a shared cyclic export graph without repeatedly expanding its branches', async () => {
  const name = 'shared-export-graph'
  const graphPath = path.join(installPath, 'node_modules', name)
  await mkdir(graphPath)
  await writeFile(
    path.join(graphPath, 'package.json'),
    JSON.stringify({ name, type: 'module', exports: './index.js' }),
  )
  await writeFile(
    path.join(graphPath, 'index.js'),
    `export * from './n0.js'; export * as Namespace from './n15.js';`,
  )
  await Promise.all(
    Array.from({ length: 30 }, (_, index) => {
      const targets = [index + 1, index + 2].filter(next => next < 30)
      const stars = targets.map(next => `export * from './n${next}.js';`)
      if (index === 29) stars.push(`export * from './index.js';`)
      return writeFile(
        path.join(graphPath, `n${index}.js`),
        `export const n${index}=${index}; ${stars.join('\n')}`,
      )
    }),
  )
  const native = await import(
    pathToFileURL(path.join(graphPath, 'index.js')).href
  )
  const exports = await getAllPackageExports(name, {
    signal: AbortSignal.timeout(3000),
    installationProvider: async () => ({
      packageName: name,
      packageString: name,
      installPath,
      packagePath: graphPath,
      async release() {},
    }),
  })
  expect(Object.keys(exports).sort()).toEqual(Object.keys(native).sort())
})
