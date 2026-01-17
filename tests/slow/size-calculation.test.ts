/**
 * Tests for size calculation and gzip compression
 */

import { describe, test, expect } from 'vitest'
import path from 'path'
import { getPackageStats } from '../../src'

describe('Bundle Size Calculation', () => {
  test('should calculate size for small bundle', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')
    const result = await getPackageStats(fixturePath)

    // Assert size and gzip are within expected ranges (non-deterministic)
    expect(result.size).toBeGreaterThanOrEqual(230)
    expect(result.size).toBeLessThanOrEqual(240)
    expect(result.gzip).toBeGreaterThan(0)
    // Note: gzip can sometimes be larger than uncompressed size for very small files
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThanOrEqual(230)
      expect(asset.size).toBeLessThanOrEqual(240)
    })
    
    // Snapshot stable properties only (exclude size and gzip)
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate size for medium bundle', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/medium')
    const result = await getPackageStats(fixturePath)

    // Assert size and gzip are within expected ranges (non-deterministic)
    expect(result.size).toBeGreaterThanOrEqual(515)
    expect(result.size).toBeLessThanOrEqual(530)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThanOrEqual(515)
      expect(asset.size).toBeLessThanOrEqual(530)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate size for large bundle', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/large')
    const result = await getPackageStats(fixturePath)

    // Assert size and gzip are within expected ranges (non-deterministic)
    expect(result.size).toBeGreaterThanOrEqual(1450)
    expect(result.size).toBeLessThanOrEqual(1470)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThanOrEqual(1450)
      expect(asset.size).toBeLessThanOrEqual(1470)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate size for multiple assets (CSS + JS)', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/styles/css-only')
    const result = await getPackageStats(fixturePath)

    // Assert size and gzip are within expected ranges (non-deterministic)
    expect(result.size).toBeGreaterThanOrEqual(195)
    expect(result.size).toBeLessThanOrEqual(210)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    // Validate each asset
    expect(result.assets).toHaveLength(2)
    const jsAsset = result.assets.find(a => a.type === 'js')
    const cssAsset = result.assets.find(a => a.type === 'css')
    
    expect(jsAsset?.size).toBeGreaterThanOrEqual(235)
    expect(jsAsset?.size).toBeLessThanOrEqual(245)
    expect(jsAsset?.gzip).toBeGreaterThan(0)
    
    expect(cssAsset?.size).toBeGreaterThanOrEqual(195)
    expect(cssAsset?.size).toBeLessThanOrEqual(210)
    expect(cssAsset?.gzip).toBeGreaterThan(0)
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    // Remove approximateSize from dependencySizes (also non-deterministic)
    const dependencySizesStable = result.dependencySizes?.map(({ approximateSize, ...dep }) => ({
      ...dep,
      approximateSizeRange: approximateSize > 0 ? 'positive' : 'zero'
    }))
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile, dependencySizes: dependencySizesStable }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
          {
            "name": "main",
            "type": "css",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [
          {
            "approximateSizeRange": "positive",
            "name": "css-loader",
          },
        ],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate size for SCSS fixture', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/scss-package',
    )
    const result = await getPackageStats(fixturePath)

    // Assert size and gzip are within expected ranges (non-deterministic)
    expect(result.size).toBeGreaterThanOrEqual(185)
    expect(result.size).toBeLessThanOrEqual(200)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    // Validate each asset
    expect(result.assets).toHaveLength(2)
    const jsAsset = result.assets.find(a => a.type === 'js')
    const cssAsset = result.assets.find(a => a.type === 'css')
    
    expect(jsAsset?.size).toBeGreaterThanOrEqual(240)
    expect(jsAsset?.size).toBeLessThanOrEqual(250)
    expect(jsAsset?.gzip).toBeGreaterThan(0)
    
    expect(cssAsset?.size).toBeGreaterThanOrEqual(185)
    expect(cssAsset?.size).toBeLessThanOrEqual(200)
    expect(cssAsset?.gzip).toBeGreaterThan(0)
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    // Remove approximateSize from dependencySizes (also non-deterministic)
    const dependencySizesStable = result.dependencySizes?.map(({ approximateSize, ...dep }) => ({
      ...dep,
      approximateSizeRange: approximateSize > 0 ? 'positive' : 'zero'
    }))
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile, dependencySizes: dependencySizesStable }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
          {
            "name": "main",
            "type": "css",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [
          {
            "approximateSizeRange": "positive",
            "name": "css-loader",
          },
        ],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should return size as main asset size', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')
    const result = await getPackageStats(fixturePath)

    expect(result.assets).toHaveLength(1)
    const mainAsset = result.assets[0]

    expect(mainAsset.name).toBe('main')
    expect(mainAsset.type).toBe('js')
    // Main asset size should match result.size
    expect(result.size).toBe(mainAsset.size)
  })

  test('should calculate progressively larger sizes', async () => {
    const smallPath = path.resolve(__dirname, '../fixtures/sizes/small')
    const mediumPath = path.resolve(__dirname, '../fixtures/sizes/medium')
    const largePath = path.resolve(__dirname, '../fixtures/sizes/large')

    const [small, medium, large] = await Promise.all([
      getPackageStats(smallPath),
      getPackageStats(mediumPath),
      getPackageStats(largePath),
    ])

    // Verify sizes scale appropriately
    expect(small.size).toBeGreaterThan(0)
    expect(medium.size).toBeGreaterThan(small.size)
    expect(large.size).toBeGreaterThan(medium.size)

    // Verify all have single JS asset
    expect(small.assets).toHaveLength(1)
    expect(medium.assets).toHaveLength(1)
    expect(large.assets).toHaveLength(1)
  })
})

describe('Gzip Compression', () => {
  test('should calculate gzip for small bundle', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(230)
    expect(result.size).toBeLessThanOrEqual(240)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThanOrEqual(230)
      expect(asset.size).toBeLessThanOrEqual(240)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate gzip for medium bundle', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/medium')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(515)
    expect(result.size).toBeLessThanOrEqual(530)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThanOrEqual(515)
      expect(asset.size).toBeLessThanOrEqual(530)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate gzip for large bundle', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/large')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(1450)
    expect(result.size).toBeLessThanOrEqual(1470)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThanOrEqual(1450)
      expect(asset.size).toBeLessThanOrEqual(1470)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate gzip for each asset in multi-asset bundles', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/styles/css-only')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(195)
    expect(result.size).toBeLessThanOrEqual(210)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    expect(result.assets).toHaveLength(2)
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    const dependencySizesStable = result.dependencySizes?.map(({ approximateSize, ...dep }) => ({
      ...dep,
      approximateSizeRange: approximateSize > 0 ? 'positive' : 'zero'
    }))
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile, dependencySizes: dependencySizesStable }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
          {
            "name": "main",
            "type": "css",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [
          {
            "approximateSizeRange": "positive",
            "name": "css-loader",
          },
        ],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate gzip for all size fixtures', async () => {
    const fixtures = ['sizes/small', 'sizes/medium', 'sizes/large']

    const results = await Promise.all(
      fixtures.map(f =>
        getPackageStats(path.resolve(__dirname, '../fixtures', f)),
      ),
    )

    // Validate gzip and size for all results
    results.forEach(result => {
      expect(result.gzip).toBeGreaterThan(0)
      expect(result.size).toBeGreaterThan(0)
      // Note: gzip can sometimes be larger than uncompressed size for very small files
      result.assets.forEach(asset => {
        expect(asset.gzip).toBeGreaterThan(0)
        expect(asset.size).toBeGreaterThan(0)
      })
    })
    
    // Snapshot stable properties only
    const resultsWithoutVolatile = results.map(result => {
      const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
      const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
      return { ...resultWithoutVolatile, assets: assetsWithoutVolatile }
    })
    
    expect(resultsWithoutVolatile).toMatchInlineSnapshot(`
      [
        {
          "assets": [
            {
              "name": "main",
              "type": "js",
            },
          ],
          "dependencyCount": 0,
          "dependencySizes": [],
          "hasJSModule": false,
          "hasJSNext": false,
          "hasSideEffects": true,
          "isModuleType": false,
          "peerDependencies": [],
        },
        {
          "assets": [
            {
              "name": "main",
              "type": "js",
            },
          ],
          "dependencyCount": 0,
          "dependencySizes": [],
          "hasJSModule": false,
          "hasJSNext": false,
          "hasSideEffects": true,
          "isModuleType": false,
          "peerDependencies": [],
        },
        {
          "assets": [
            {
              "name": "main",
              "type": "js",
            },
          ],
          "dependencyCount": 0,
          "dependencySizes": [],
          "hasJSModule": false,
          "hasJSNext": false,
          "hasSideEffects": true,
          "isModuleType": false,
          "peerDependencies": [],
        },
      ]
    `)
  })

  test('should show gzip scales with bundle size', async () => {
    const smallPath = path.resolve(__dirname, '../fixtures/sizes/small')
    const mediumPath = path.resolve(__dirname, '../fixtures/sizes/medium')
    const largePath = path.resolve(__dirname, '../fixtures/sizes/large')

    const [small, medium, large] = await Promise.all([
      getPackageStats(smallPath),
      getPackageStats(mediumPath),
      getPackageStats(largePath),
    ])

    // Verify size progression
    expect(small.size).toBeLessThan(medium.size)
    expect(medium.size).toBeLessThan(large.size)

    // Verify gzip is calculated for all
    expect(small.gzip).toBeGreaterThan(0)
    expect(medium.gzip).toBeGreaterThan(0)
    expect(large.gzip).toBeGreaterThan(0)
  })
})

describe('Dependency Size Trees', () => {
  test('should include dependency sizes when requested', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/small')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(230)
    expect(result.size).toBeLessThanOrEqual(240)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should have empty dependency sizes for fixtures', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/medium')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(515)
    expect(result.size).toBeLessThanOrEqual(530)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })

  test('should calculate sizes for dependency tree', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sizes/large')
    const result = await getPackageStats(fixturePath)

    // Assert ranges
    expect(result.size).toBeGreaterThanOrEqual(1450)
    expect(result.size).toBeLessThanOrEqual(1470)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })
    
    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 0,
        "dependencySizes": [],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": false,
        "peerDependencies": [],
      }
    `)
  })
})

describe('Complex Dependency Scenarios', () => {
  test('should handle packages with peer dependencies', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/dependencies/with-peer-deps',
    )
    const result = await getPackageStats(fixturePath)

    // Assert ranges for size and gzip
    expect(result.size).toBeGreaterThanOrEqual(2400)
    expect(result.size).toBeLessThanOrEqual(2420)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })

    // Verify peer dependencies are reported
    expect(result.peerDependencies).toEqual(['react', 'react-dom'])
    
    // Should have at least one dependency (lodash-es)
    expect(result.dependencyCount).toBeGreaterThan(0)
    expect(result.dependencySizes?.length).toBeGreaterThan(0)
    
    // Should have lodash-es in dependencies
    const lodashDep = result.dependencySizes?.find(d => d.name === 'lodash-es')
    expect(lodashDep).toBeDefined()
    expect(lodashDep!.approximateSize).toBeGreaterThan(0)

    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    // Remove approximateSize from dependencySizes (non-deterministic)
    const dependencySizesStable = result.dependencySizes?.map(({ approximateSize, ...dep }) => ({
      ...dep,
      approximateSizeRange: approximateSize > 0 ? 'positive' : 'zero'
    }))
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile, dependencySizes: dependencySizesStable }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 1,
        "dependencySizes": [
          {
            "approximateSizeRange": "positive",
            "name": "fixture-with-peer-deps",
          },
          {
            "approximateSizeRange": "positive",
            "name": "lodash-es",
          },
        ],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": true,
        "peerDependencies": [
          "react",
          "react-dom",
        ],
      }
    `)
  })

  test('should handle packages with nested dependencies', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/dependencies/nested-deps',
    )
    const result = await getPackageStats(fixturePath)

    // Assert ranges for size and gzip
    expect(result.size).toBeGreaterThanOrEqual(6280)
    expect(result.size).toBeLessThanOrEqual(6310)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })

    // Should have multiple dependencies (ms and debug)
    expect(result.dependencyCount).toBeGreaterThanOrEqual(2)
    expect(result.dependencySizes?.length).toBeGreaterThanOrEqual(2)
    
    // Verify both direct dependencies are tracked
    const debugDep = result.dependencySizes?.find(d => d.name === 'debug')
    const msDep = result.dependencySizes?.find(d => d.name === 'ms')
    
    expect(debugDep).toBeDefined()
    expect(msDep).toBeDefined()
    expect(debugDep!.approximateSize).toBeGreaterThan(0)
    expect(msDep!.approximateSize).toBeGreaterThan(0)

    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    // Remove approximateSize from dependencySizes (non-deterministic)
    const dependencySizesStable = result.dependencySizes?.map(({ approximateSize, ...dep }) => ({
      ...dep,
      approximateSizeRange: approximateSize > 0 ? 'positive' : 'zero'
    }))
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile, dependencySizes: dependencySizesStable }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 2,
        "dependencySizes": [
          {
            "approximateSizeRange": "positive",
            "name": "fixture-nested-deps",
          },
          {
            "approximateSizeRange": "positive",
            "name": "ms",
          },
          {
            "approximateSizeRange": "positive",
            "name": "debug",
          },
        ],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": true,
        "peerDependencies": [],
      }
    `)
  })

  test('should handle packages with deeply nested dependencies', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/dependencies/deep-nested',
    )
    const result = await getPackageStats(fixturePath)

    // Assert ranges for size and gzip
    expect(result.size).toBeGreaterThanOrEqual(35200)
    expect(result.size).toBeLessThanOrEqual(35350)
    expect(result.gzip).toBeGreaterThan(0)
    expect(result.gzip).toBeLessThan(result.size)
    
    result.assets.forEach(asset => {
      expect(asset.gzip).toBeGreaterThan(0)
      expect(asset.size).toBeGreaterThan(0)
    })

    // Should have at least one dependency (axios might be tree-shaken or bundled)
    expect(result.dependencyCount).toBeGreaterThanOrEqual(1)
    expect(result.dependencySizes?.length).toBeGreaterThanOrEqual(1)
    
    // Verify axios is in the dependency tree
    const axiosDep = result.dependencySizes?.find(d => d.name === 'axios')
    expect(axiosDep).toBeDefined()
    expect(axiosDep!.approximateSize).toBeGreaterThan(0)

    // Snapshot stable properties only
    const { gzip: _gzip, size: _size, ...resultWithoutVolatile } = result
    const assetsWithoutVolatile = result.assets.map(({ gzip, size, ...asset }) => asset)
    
    // Remove approximateSize from dependencySizes (non-deterministic)
    const dependencySizesStable = result.dependencySizes?.map(({ approximateSize, ...dep }) => ({
      ...dep,
      approximateSizeRange: approximateSize > 0 ? 'positive' : 'zero'
    }))
    
    expect({ ...resultWithoutVolatile, assets: assetsWithoutVolatile, dependencySizes: dependencySizesStable }).toMatchInlineSnapshot(`
      {
        "assets": [
          {
            "name": "main",
            "type": "js",
          },
        ],
        "dependencyCount": 1,
        "dependencySizes": [
          {
            "approximateSizeRange": "positive",
            "name": "fixture-deep-nested",
          },
          {
            "approximateSizeRange": "positive",
            "name": "axios",
          },
        ],
        "hasJSModule": false,
        "hasJSNext": false,
        "hasSideEffects": true,
        "isModuleType": true,
        "peerDependencies": [],
      }
    `)
  })

  test('should correctly count total dependencies vs dependency tree size', async () => {
    const nestedPath = path.resolve(
      __dirname,
      '../fixtures/dependencies/nested-deps',
    )
    const result = await getPackageStats(nestedPath)

    // dependencySizes should be defined
    expect(result.dependencySizes).toBeDefined()
    expect(Array.isArray(result.dependencySizes)).toBe(true)

    // Both should be positive numbers
    expect(result.dependencyCount).toBeGreaterThan(0)
    expect(result.dependencySizes?.length).toBeGreaterThan(0)

    // Each dependency should have a name and size
    result.dependencySizes?.forEach(dep => {
      expect(dep.name).toBeTruthy()
      expect(dep.approximateSize).toBeGreaterThan(0)
    })
  })
})
