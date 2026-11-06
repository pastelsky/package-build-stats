import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { exportBatches } from '../../src/utils/export-batches.utils.js'
import { BuildCancelledError } from '../../src/errors/CustomError.js'
import { getPackageExportSizes } from '../../src/getPackageExportSizes.js'
import BuildUtils from '../../src/utils/build.utils.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'export-batches-'))
  await mkdir(path.join(root, 'node_modules'))
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

async function collect(stream: AsyncIterable<string[]>) {
  const result: string[][] = []
  for await (const batch of stream) result.push(batch)
  return result
}

async function batches(count: number, size?: number) {
  if (size !== undefined) {
    await writeFile(path.join(root, 'node_modules/source.js'), '')
    await truncate(path.join(root, 'node_modules/source.js'), size)
  }
  const names = Array.from({ length: count }, (_, i) => `export${i}`)
  const exportMap = Object.fromEntries(
    names.map(name => [name, 'node_modules/source.js']),
  )
  return collect(exportBatches(names, exportMap, root))
}

test('keeps hundred-entry batches for small sources in original order', async () => {
  const result = await batches(250, 1024)
  expect(result.map(batch => batch.length)).toEqual([100, 100, 50])
  expect(result.flat()).toEqual(
    Array.from({ length: 250 }, (_, i) => `export${i}`),
  )
})

test('counts a large shared source once per generated export', async () => {
  const result = await batches(25, 4_711_728)
  expect(result.map(batch => batch.length)).toEqual([10, 10, 5])
  expect(new Set(result.flat()).size).toBe(25)
})

test('allows an oversized individual source without creating empty batches', async () => {
  expect(await batches(2, 64 * 1024 * 1024)).toEqual([['export0'], ['export1']])
})

test('isolates missing source costs so compilation can classify the error', async () => {
  expect(await batches(2)).toEqual([['export0'], ['export1']])
})

test('does no work when cancelled before batching', async () => {
  await expect(
    collect(
      exportBatches(
        ['name'],
        { name: 'node_modules/source.js' },
        root,
        AbortSignal.abort(),
      ),
    ),
  ).rejects.toBeInstanceOf(BuildCancelledError)
})

test('the public export-size operation compiles every export in source-budgeted batches', async () => {
  const packageName = 'batch-fixture'
  const packagePath = path.join(root, 'node_modules', packageName)
  await mkdir(packagePath)
  await writeFile(
    path.join(packagePath, 'package.json'),
    JSON.stringify({
      name: packageName,
      type: 'module',
      exports: './index.js',
    }),
  )
  const names = Array.from({ length: 25 }, (_, index) => `name${index}`)
  await writeFile(
    path.join(packagePath, 'index.js'),
    `/*${'x'.repeat(4_711_728)}*/\n${names.map(name => `export const ${name}=1;`).join('\n')}`,
  )
  const build = vi
    .spyOn(BuildUtils, 'buildPackageIgnoringMissingDeps')
    .mockImplementation(async ({ options }) => ({
      assets: (options.customImports || []).map(name => ({
        name,
        type: 'js',
        size: 10,
        gzip: 5,
      })),
    }))
  const release = vi.fn(async () => {})
  const result = await getPackageExportSizes(packageName, {
    installationProvider: async () => ({
      packageName,
      packageString: packageName,
      installPath: root,
      packagePath,
      release,
    }),
  })
  expect(
    build.mock.calls.map(([args]) => args.options.customImports?.length),
  ).toEqual([10, 10, 5])
  expect(result.assets.map(asset => asset.name).sort()).toEqual(names.sort())
  expect(release).toHaveBeenCalledOnce()
})
