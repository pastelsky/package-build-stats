/**
 * @jest-environment node
 *
 * Tests that re-exports resolve to their actual source files, not the declaring file.
 * 
 * For example, lodash-es has:
 *   export { default as add } from './add.js'
 * 
 * The path for 'add' should be './add.js', not './lodash.js' (the entry file).
 * 
 * This is important for accurate bundle analysis and understanding where
 * each export actually comes from.
 */

import path from 'path'
import { getAllExports } from '../../src/utils/exports.utils'

describe('Re-export source path resolution', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../fixtures/exports/reexport-source-paths',
  )

  test('should resolve re-exports to their actual source files', async () => {
    const exports = await getAllExports(
      'reexport-source-paths-fixture',
      fixturePath,
      'reexport-source-paths-fixture',
      fixturePath,
    )

    // Should have 4 exports: add, subtract, multiply, localHelper
    expect(Object.keys(exports).length).toBe(4)

    // Re-exports should point to their source files, not index.js
    expect(exports['add']).toContain('add.js')
    expect(exports['subtract']).toContain('subtract.js')
    expect(exports['multiply']).toContain('multiply.js')

    // Local export should point to index.js
    expect(exports['localHelper']).toContain('index.js')
  })

  test('should have unique paths for re-exported items', async () => {
    const exports = await getAllExports(
      'reexport-source-paths-fixture',
      fixturePath,
      'reexport-source-paths-fixture',
      fixturePath,
    )

    const paths = Object.values(exports)
    const uniquePaths = [...new Set(paths)]

    // Should have 4 unique paths (add.js, subtract.js, multiply.js, index.js)
    expect(uniquePaths.length).toBe(4)

    // Verify no two re-exports share the same path (except localHelper in index.js)
    expect(exports['add']).not.toBe(exports['subtract'])
    expect(exports['add']).not.toBe(exports['multiply'])
    expect(exports['subtract']).not.toBe(exports['multiply'])
  })

  test('should NOT have all exports pointing to the same file (regression test)', async () => {
    // This is a regression test for the bug where all exports pointed to the entry file
    // because we weren't following re-exports to their source.

    const exports = await getAllExports(
      'reexport-source-paths-fixture',
      fixturePath,
      'reexport-source-paths-fixture',
      fixturePath,
    )

    const paths = Object.values(exports)
    const uniquePaths = [...new Set(paths)]

    // Before fix: uniquePaths.length === 1 (all pointing to index.js)
    // After fix: uniquePaths.length === 4 (each export has its own source file)
    expect(uniquePaths.length).toBeGreaterThan(1)
  })
})
