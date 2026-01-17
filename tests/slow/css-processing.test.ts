/**
 * @jest-environment node
 *
 * Tests for CSS/SCSS/Less processing and extraction
 */

import path from 'path'
import { getPackageStats } from '../../src'

describe('CSS Processing', () => {
  test('should extract CSS to separate file', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/styles/css-only')
    const result = await getPackageStats(fixturePath)

    // Should have exactly 2 assets: JS and CSS
    expect(result.assets).toHaveLength(2)

    const jsAsset = result.assets.find(a => a.type === 'js')
    const cssAsset = result.assets.find(a => a.type === 'css')

    // Asset structure assertions
    expect(jsAsset).toBeDefined()
    expect(jsAsset?.name).toBe('main')
    expect(jsAsset?.type).toBe('js')

    expect(cssAsset).toBeDefined()
    expect(cssAsset?.name).toBe('main')
    expect(cssAsset?.type).toBe('css')

    // Size range assertions (CSS fixtures ~200-350 bytes)
    expect(jsAsset!.size).toBeBetween(200, 350)
    expect(jsAsset!.gzip).toBeBetween(150, 350)

    expect(cssAsset!.size).toBeBetween(180, 280)
    expect(cssAsset!.gzip).toBeBetween(140, 230)
  })

  test('should minify CSS', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/styles/css-only')
    const result = await getPackageStats(fixturePath)

    const cssAsset = result.assets.find(a => a.type === 'css')

    // Specific assertions (minified CSS ~180-220 bytes)
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.size).toBeBetween(180, 280)
    expect(cssAsset!.gzip).toBeBetween(140, 230)
  })

  test('should use LightningCssMinimizerRspackPlugin for CSS', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/styles/css-only')
    const result = await getPackageStats(fixturePath)

    const cssAsset = result.assets.find(a => a.type === 'css')

    // CSS should be minified (original is ~300 bytes with whitespace)
    // Minified should be significantly smaller (~180-220 bytes)
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.size).toBeBetween(180, 280)
  })

  test('should extract CSS from imports', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/styles/css-only')
    const result = await getPackageStats(fixturePath)

    expect(result.assets).toHaveLength(2)
    const cssAsset = result.assets.find(a => a.type === 'css')
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.name).toBe('main')
    expect(cssAsset!.type).toBe('css')
  })
})

describe('SCSS Processing', () => {
  test('should compile SCSS to CSS', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/scss-package',
    )
    const result = await getPackageStats(fixturePath)

    // Should have exactly 2 assets: JS and CSS
    expect(result.assets).toHaveLength(2)

    const cssAsset = result.assets.find(a => a.type === 'css')
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.name).toBe('main')
    expect(cssAsset!.type).toBe('css')
  })

  test('should process SCSS variables', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/scss-package',
    )
    const result = await getPackageStats(fixturePath)

    const cssAsset = result.assets.find(a => a.type === 'css')

    // SCSS variables should be compiled to actual values
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.size).toBeBetween(50, 300)
  })

  test('should process SCSS nesting', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/scss-package',
    )
    const result = await getPackageStats(fixturePath)

    const cssAsset = result.assets.find(a => a.type === 'css')

    // SCSS nesting should be compiled and minified
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.size).toBeBetween(50, 300)
    expect(cssAsset!.gzip).toBeBetween(40, 250)
  })

  test('should use sass-loader for SCSS compilation', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/scss-package',
    )
    const result = await getPackageStats(fixturePath)

    // Should successfully compile without errors
    expect(result.assets).toHaveLength(2)
    const cssAsset = result.assets.find(a => a.type === 'css')
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.name).toBe('main')
  })
})

describe('Less Processing', () => {
  test('should compile Less to CSS', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/less-package',
    )
    const result = await getPackageStats(fixturePath)

    // Should have exactly 2 assets: JS and CSS
    expect(result.assets).toHaveLength(2)

    const cssAsset = result.assets.find(a => a.type === 'css')
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.name).toBe('main')
    expect(cssAsset!.type).toBe('css')
  })

  test('should process Less variables', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/less-package',
    )
    const result = await getPackageStats(fixturePath)

    const cssAsset = result.assets.find(a => a.type === 'css')

    // Less variables should be compiled to actual values
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.size).toBeGreaterThan(0)
    expect(cssAsset!.gzip).toBeGreaterThan(0)
  })

  test('should use less-loader for Less compilation', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/less-package',
    )
    const result = await getPackageStats(fixturePath)

    // Should successfully compile without errors
    expect(result.assets).toHaveLength(2)
    const cssAsset = result.assets.find(a => a.type === 'css')
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.name).toBe('main')
  })
})

describe('Svelte Processing', () => {
  test('should compile Svelte component with scoped styles', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/svelte-package',
    )
    const result = await getPackageStats(fixturePath)

    // Should have exactly 2 assets: JS and CSS
    expect(result.assets).toHaveLength(2)

    const jsAsset = result.assets.find(a => a.type === 'js')
    const cssAsset = result.assets.find(a => a.type === 'css')

    expect(jsAsset).toBeDefined()
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.name).toBe('main')
    expect(cssAsset!.type).toBe('css')
  })

  test('should extract CSS from Svelte component', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/svelte-package',
    )
    const result = await getPackageStats(fixturePath)

    const cssAsset = result.assets.find(a => a.type === 'css')

    // Svelte scoped styles should be extracted
    expect(cssAsset).toBeDefined()
    expect(cssAsset!.size).toBeGreaterThan(0)
    expect(cssAsset!.gzip).toBeGreaterThan(0)
  })

  test('should use svelte-loader for Svelte compilation', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../fixtures/styles/svelte-package',
    )
    const result = await getPackageStats(fixturePath)

    // Should successfully compile without errors
    expect(result.assets).toHaveLength(2)
    const jsAsset = result.assets.find(a => a.type === 'js')
    expect(jsAsset).toBeDefined()
    expect(jsAsset!.name).toBe('main')
  })
})
