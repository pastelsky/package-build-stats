/**
 * @jest-environment node
 *
 * Regression coverage for packages that publish TypeScript source, including
 * Expo packages whose JavaScript entry eventually imports expo-modules-core
 * TypeScript files.
 */

import path from 'path'
import { getPackageStats } from '../../src'

describe('Published TypeScript source', () => {
  test.each([
    ['a TypeScript package entry', 'typescript-source'],
    ['TypeScript imported from a JavaScript entry', 'typescript-dependency'],
  ])('builds %s', async (_scenario, fixtureName) => {
    const fixturePath = path.resolve(
      __dirname,
      `../fixtures/basic/${fixtureName}`,
    )

    const result = await getPackageStats(fixturePath)

    expect(result.size).toBeGreaterThan(0)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'main',
          type: 'js',
        }),
      ]),
    )
  })
})
