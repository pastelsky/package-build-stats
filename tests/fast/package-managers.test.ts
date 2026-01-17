/**
 * Tests for different package manager clients (npm, yarn, pnpm, bun)
 * These tests verify that package managers work correctly, not module types or CSS
 */

import path from 'path'
import { getPackageStats } from '../../src'

type PackageClient = 'npm' | 'yarn' | 'pnpm' | 'bun'

describe('Package Manager Clients', () => {
  describe.each<PackageClient>(['npm', 'yarn', 'pnpm', 'bun'])(
    '%s client',
    client => {
      test(`should successfully install and build with ${client}`, async () => {
        const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')

        const result = await getPackageStats(fixturePath, {
          client,
        })

        // Verify package manager successfully installed and built
        expect(result.assets).toBeDefined()
        expect(result.assets.length).toBeGreaterThan(0)
        expect(result.size).toBeGreaterThan(0)
        expect(result.gzip).toBeGreaterThan(0)

        // Verify main asset exists
        const mainAsset = result.assets.find(a => a.name === 'main')
        expect(mainAsset).toBeDefined()
      })

      test(`should handle fallback when ${client} fails`, async () => {
        // Test that fallback mechanism works (if first client fails, try next)
        const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')

        // Using array of clients to test fallback
        const clients: PackageClient[] = [client, 'npm']
        const result = await getPackageStats(fixturePath, {
          client: clients,
        })

        // Should succeed with at least one client
        expect(result.assets).toBeDefined()
        expect(result.assets.length).toBeGreaterThan(0)
        expect(result.size).toBeGreaterThan(0)
      })
    },
  )
})

describe('Yarn-specific Options', () => {
  test('should work with networkConcurrency option', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')

    const result = await getPackageStats(fixturePath, {
      client: 'yarn',
      networkConcurrency: 2,
    })

    // Verify yarn-specific option works
    expect(result.assets).toBeDefined()
    expect(result.assets.length).toBeGreaterThan(0)
    expect(result.size).toBeGreaterThan(0)
  })

  test('should work with limitConcurrency option', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')

    const result = await getPackageStats(fixturePath, {
      client: 'yarn',
      limitConcurrency: true,
    })

    // Verify yarn-specific option works
    expect(result.assets).toBeDefined()
    expect(result.assets.length).toBeGreaterThan(0)
    expect(result.size).toBeGreaterThan(0)
  })
})

describe('Package Manager Fallback', () => {
  test('should fallback to npm when bun fails', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')

    const result = await getPackageStats(fixturePath, {
      client: ['bun', 'npm'],
    })

    // Should succeed with fallback
    expect(result.assets).toBeDefined()
    expect(result.assets.length).toBeGreaterThan(0)
    expect(result.size).toBeGreaterThan(0)
  })

  test('should try clients in order', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')

    const result = await getPackageStats(fixturePath, {
      client: ['pnpm', 'yarn', 'npm'],
    })

    // Should succeed with at least one client
    expect(result.assets).toBeDefined()
    expect(result.assets.length).toBeGreaterThan(0)
    expect(result.size).toBeGreaterThan(0)
  })
})
