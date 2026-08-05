import path from 'node:path'
import { getImportPointsFromPackage } from '../../src/utils/importPoints.utils.js'

const fixturePath = path.resolve(__dirname, '../fixtures/exports/import-points')

describe('getImportPointsFromPackage', () => {
  test('lists explicit and expanded public import points', async () => {
    await expect(
      getImportPointsFromPackage('import-points-fixture', fixturePath),
    ).resolves.toEqual([
      'import-points-fixture',
      'import-points-fixture/feature',
      'import-points-fixture/features/alpha',
      'import-points-fixture/features/beta',
      'import-points-fixture/runtime-specific',
    ])
  })

  test('does not list private, manifest, or type-only targets', async () => {
    const importPoints = await getImportPointsFromPackage(
      'import-points-fixture',
      fixturePath,
    )

    expect(importPoints).not.toContain('import-points-fixture/private')
    expect(importPoints).not.toContain('import-points-fixture/package.json')
    expect(importPoints).not.toContain(
      'import-points-fixture/features/private/internal',
    )
    expect(importPoints).not.toContain(
      'import-points-fixture/features/types.d.ts',
    )
  })

  test('lists importable files when exports metadata is absent', async () => {
    const legacyFixturePath = path.resolve(
      __dirname,
      '../fixtures/basic/simple-esm',
    )

    await expect(
      getImportPointsFromPackage('simple-esm-fixture', legacyFixturePath),
    ).resolves.toEqual([
      'simple-esm-fixture',
      'simple-esm-fixture/src/index.js',
    ])
  })
})
