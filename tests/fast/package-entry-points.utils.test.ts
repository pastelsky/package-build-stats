import path from 'node:path'
import { getEntryPointsFromPackage } from '../../src/utils/packageEntryPoints.utils.js'

const fixturePath = path.resolve(
  __dirname,
  '../fixtures/exports/package-entry-points',
)

describe('getEntryPointsFromPackage', () => {
  test('lists explicit and expanded package entry points', async () => {
    await expect(
      getEntryPointsFromPackage('entry-points-fixture', fixturePath),
    ).resolves.toEqual([
      'entry-points-fixture',
      'entry-points-fixture/feature',
      'entry-points-fixture/features/alpha',
      'entry-points-fixture/features/beta',
      'entry-points-fixture/runtime-specific',
    ])
  })

  test('does not list private, manifest, or type-only targets', async () => {
    const entryPoints = await getEntryPointsFromPackage(
      'entry-points-fixture',
      fixturePath,
    )

    expect(entryPoints).not.toContain('entry-points-fixture/private')
    expect(entryPoints).not.toContain('entry-points-fixture/package.json')
    expect(entryPoints).not.toContain(
      'entry-points-fixture/features/private/internal',
    )
    expect(entryPoints).not.toContain(
      'entry-points-fixture/features/types.d.ts',
    )
  })

  test('lists importable files when exports metadata is absent', async () => {
    const legacyFixturePath = path.resolve(
      __dirname,
      '../fixtures/basic/simple-esm',
    )

    await expect(
      getEntryPointsFromPackage('simple-esm-fixture', legacyFixturePath),
    ).resolves.toEqual([
      'simple-esm-fixture',
      'simple-esm-fixture/src/index.js',
    ])
  })
})
