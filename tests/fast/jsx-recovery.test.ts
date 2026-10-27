import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  getPackageStats,
  getPackageExportSizes,
  BuildError,
} from '../../src/index.js'

const roots: string[] = []
async function prepare(files: Record<string, string>, dependencies = {}) {
  const installPath = await mkdtemp(path.join(tmpdir(), 'jsx-recovery-'))
  roots.push(installPath)
  const packageName = 'jsx-recovery-fixture'
  const packagePath = path.join(installPath, 'node_modules', packageName)
  await mkdir(packagePath, { recursive: true })
  await writeFile(
    path.join(packagePath, 'package.json'),
    JSON.stringify({
      name: packageName,
      version: '1.0.0',
      main: 'index.js',
      peerDependencies: { react: '*' },
      dependencies,
    }),
  )
  await Promise.all(
    Object.entries(files).map(async ([file, source]) => {
      await mkdir(path.dirname(path.join(packagePath, file)), {
        recursive: true,
      })
      await writeFile(path.join(packagePath, file), source)
    }),
  )
  return {
    name: packageName,
    options: {
      installationProvider: async () => ({
        packageName,
        packageString: packageName,
        installPath,
        packagePath,
        async release() {},
      }),
    },
  }
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

test('builds JSX in sibling and nested .js modules through package and export analysis', async () => {
  const fixture = await prepare({
    'index.js': `import React from 'react'; import Child from './nested/child.js'; import legacy from './legacy.js'; export function Main() { return <Child value={legacy}/> }; export {default as Child} from './nested/child.js'`,
    'nested/child.js': `import React from 'react'; export default function Child() { return <><span>child</span></> }`,
    'legacy.js': `if (false) return; module.exports = 42`,
  })
  const stats = await getPackageStats(fixture.name, fixture.options)
  expect(stats.size).toBeGreaterThan(0)
  expect(stats.gzip).toBeGreaterThan(0)
  expect(stats.ignoredMissingDependencies).toBeUndefined()
  const exports = await getPackageExportSizes(fixture.name, fixture.options)
  expect(exports.assets.map(asset => asset.name).sort()).toEqual([
    'Child',
    'Main',
  ])
  expect(exports.assets.every(asset => asset.size > 0 && asset.gzip > 0)).toBe(
    true,
  )
})

test('recovers JSX in a transitive package without transforming all installed dependencies', async () => {
  const fixture = await prepare(
    {
      'index.js': `export {default} from 'jsx-child'`,
      '../jsx-child/package.json': JSON.stringify({
        name: 'jsx-child',
        version: '1.0.0',
        main: 'index.js',
      }),
      '../jsx-child/index.js': `import React from 'react'; export default function Child() { return <div/> }`,
    },
    { 'jsx-child': '1.0.0' },
  )
  const stats = await getPackageStats(fixture.name, fixture.options)
  expect(stats.size).toBeGreaterThan(0)
  expect(stats.dependencySizes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'jsx-child',
        approximateSize: expect.any(Number),
      }),
    ]),
  )
})

test('keeps valid CommonJS with JSX-like strings and comments working', async () => {
  const fixture = await prepare({
    'index.js': `if (false) return; // <div>not JSX</div>\nmodule.exports = '<span>also not JSX</span>'`,
  })
  const stats = await getPackageStats(fixture.name, fixture.options)
  expect(stats.size).toBeGreaterThan(0)
})

test.each([
  `export const broken = ;`,
  `import React from 'react'; export function Main() { return <div> }`,
  `import React from 'react'; export function Main(value: number) { return <div/> }`,
])(
  'does not conceal malformed JavaScript, malformed JSX or unsupported Flow syntax: %s',
  async source => {
    const fixture = await prepare({ 'index.js': source })
    await expect(
      getPackageStats(fixture.name, fixture.options),
    ).rejects.toBeInstanceOf(BuildError)
  },
)
