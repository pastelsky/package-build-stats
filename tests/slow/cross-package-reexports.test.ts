/**
 * @jest-environment node
 *
 * Tests for cross-package re-exports resolution
 * 
 * This tests the fix for packages like Vue that use:
 *   export * from '@vue/runtime-dom'
 * 
 * The dependency (@vue/runtime-dom) has both CJS and ESM exports with a "node" condition
 * that points to CJS. The resolver must correctly pick ESM (via "import" condition)
 * to find the named exports.
 * 
 * Bug: Prior to the fix, conditionNames included ['import', 'require', 'node', 'default']
 * which caused the resolver to pick CJS files (no ESM exports) via the "node" condition.
 * 
 * Fix: Changed conditionNames to ['import', 'default'] to prioritize ESM.
 */

import path from 'path'
import { getAllExports } from '../../src/utils/exports.utils'

describe('Cross-package re-exports resolution', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../fixtures/exports/cross-package-reexports',
  )

  test('should resolve ESM exports from dependency via export * from', async () => {
    // This simulates the Vue scenario where:
    // - vue/dist/vue.runtime.esm-bundler.js has: export * from '@vue/runtime-dom'
    // - @vue/runtime-dom has both CJS (index.js) and ESM (dist/runtime-dom.esm-bundler.js)
    // - The "node" condition in exports points to CJS
    // - We need to resolve to ESM to get the named exports

    const exports = await getAllExports(
      'cross-package-reexports-fixture',
      fixturePath,
      'cross-package-reexports-fixture',
      fixturePath,
    )

    // Should find the local export
    expect(exports).toHaveProperty('localExport')

    // Should find exports from internal-dep via export * from
    // These only exist in the ESM build, not in the CJS build
    expect(exports).toHaveProperty('createApp')
    expect(exports).toHaveProperty('ref')
    expect(exports).toHaveProperty('reactive')
    expect(exports).toHaveProperty('computed')
    expect(exports).toHaveProperty('watch')
    expect(exports).toHaveProperty('VERSION')

    // Total should be 7 exports (1 local + 6 from internal-dep)
    expect(Object.keys(exports).length).toBe(7)
  })

  test('should find more than just local exports (regression test)', async () => {
    // This is a regression test for the bug where only 'localExport' was found
    // because the resolver picked the CJS file which has no ESM module syntax

    const exports = await getAllExports(
      'cross-package-reexports-fixture',
      fixturePath,
      'cross-package-reexports-fixture',
      fixturePath,
    )

    const exportCount = Object.keys(exports).length

    // Before fix: exportCount === 1 (only 'localExport')
    // After fix: exportCount === 7 (1 local + 6 from internal-dep)
    expect(exportCount).toBeGreaterThan(1)
  })
})
