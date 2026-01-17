/**
 * @jest-environment node
 *
 * Tests for package string parsing utilities
 */

import path from 'path'
import { parsePackageString } from '../../src/utils/common.utils'

describe('Package String Parsing', () => {
  test('should parse unscoped package without version', () => {
    const result = parsePackageString('lodash')
    expect(result.name).toBe('lodash')
    expect(result.version).toBe(null)
    expect(result.scoped).toBe(false)
    // isLocal is undefined for non-local packages
    expect(result.isLocal).toBeUndefined()
  })

  test('should parse unscoped package with version', () => {
    const result = parsePackageString('lodash@4.17.21')
    expect(result.name).toBe('lodash')
    expect(result.version).toBe('4.17.21')
    expect(result.scoped).toBe(false)
    expect(result.isLocal).toBeUndefined()
  })

  test('should parse scoped package without version', () => {
    const result = parsePackageString('@babel/core')
    expect(result.name).toBe('@babel/core')
    expect(result.version).toBe(null)
    expect(result.scoped).toBe(true)
    expect(result.isLocal).toBeUndefined()
  })

  test('should parse scoped package with version', () => {
    const result = parsePackageString('@babel/core@7.28.5')
    expect(result.name).toBe('@babel/core')
    expect(result.version).toBe('7.28.5')
    expect(result.scoped).toBe(true)
    expect(result.isLocal).toBeUndefined()
  })

  test('should parse local package path and read package.json', async () => {
    // Use actual fixture path that exists
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-esm')
    const result = parsePackageString(fixturePath)

    // For local packages, name and version come from package.json
    expect(result.isLocal).toBe(true)
    expect(result.name).toBe('simple-esm-fixture')
    expect(result.version).toBe('1.0.0')
    expect(result.normalPath).toBe(fixturePath)
    expect(result.scoped).toBe(false)
  })

  test('should parse another local package path', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/basic/simple-cjs')
    const result = parsePackageString(fixturePath)

    expect(result.isLocal).toBe(true)
    expect(result.name).toBe('simple-cjs-fixture')
    expect(result.normalPath).toBe(fixturePath)
    expect(result.scoped).toBe(false)
  })
})
