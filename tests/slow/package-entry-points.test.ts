import path from 'node:path'
import {
  getPackageEntryPoints,
  getPackageStats,
  InvalidPackageEntryPointError,
} from '../../src/index.js'

const fixturePath = path.resolve(
  __dirname,
  '../fixtures/exports/package-entry-points',
)

describe('package entry points', () => {
  test('discovers entry points from an installed package', async () => {
    await expect(getPackageEntryPoints(fixturePath)).resolves.toEqual([
      'entry-points-fixture',
      'entry-points-fixture/feature',
      'entry-points-fixture/features/alpha',
      'entry-points-fixture/features/beta',
      'entry-points-fixture/runtime-specific',
    ])
  })

  test('builds an explicitly selected entry point', async () => {
    const [rootResult, featureResult] = await Promise.all([
      getPackageStats(fixturePath),
      getPackageStats(fixturePath, {
        entryPoint: 'entry-points-fixture/feature',
      }),
    ])

    expect(featureResult.size).toBeGreaterThan(0)
    expect(featureResult.gzip).toBeGreaterThan(0)
    expect(featureResult.size).toBeLessThan(rootResult.size)
  })

  test('rejects values not returned by entry-point discovery', async () => {
    const entryPoint = 'entry-points-fixture/feature"; process.exit(1); //'

    await expect(
      getPackageStats(fixturePath, { entryPoint }),
    ).rejects.toMatchObject({
      name: new InvalidPackageEntryPointError(entryPoint).name,
      extra: { entryPoint },
    })
  })
})
