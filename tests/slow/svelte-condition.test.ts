import path from 'node:path'
import { describe, expect, test } from 'vitest'

import getPackageStats from '../../src/getPackageStats'

describe('Svelte export condition', () => {
  test('resolves a package root exposed only through the svelte condition', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/exports/svelte-condition',
    )

    const result = await getPackageStats(fixturePath)

    expect(result.assets).toHaveLength(1)
    expect(result.assets[0]?.type).toBe('js')
    expect(result.assets[0]?.size).toBeGreaterThan(0)
  })
})
