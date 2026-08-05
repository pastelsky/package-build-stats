import path from 'node:path'
import {
  getPackageImportPoints,
  getPackageStats,
  InvalidImportPointError,
} from '../../src/index.js'

const fixturePath = path.resolve(__dirname, '../fixtures/exports/import-points')

describe('package import points', () => {
  test('discovers public import points from an installed package', async () => {
    await expect(getPackageImportPoints(fixturePath)).resolves.toEqual([
      'import-points-fixture',
      'import-points-fixture/feature',
      'import-points-fixture/features/alpha',
      'import-points-fixture/features/beta',
      'import-points-fixture/runtime-specific',
    ])
  })

  test('builds an explicitly selected import point', async () => {
    const [rootResult, featureResult] = await Promise.all([
      getPackageStats(fixturePath),
      getPackageStats(fixturePath, {
        importPoint: 'import-points-fixture/feature',
      }),
    ])

    expect(featureResult.size).toBeGreaterThan(0)
    expect(featureResult.gzip).toBeGreaterThan(0)
    expect(featureResult.size).toBeLessThan(rootResult.size)
  })

  test('rejects values not returned by import-point discovery', async () => {
    const importPoint = 'import-points-fixture/feature"; process.exit(1); //'

    await expect(
      getPackageStats(fixturePath, { importPoint }),
    ).rejects.toMatchObject({
      name: new InvalidImportPointError(importPoint).name,
      extra: { importPoint },
    })
  })
})
