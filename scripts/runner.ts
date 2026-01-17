/**
 * Simple runner for executing package-build-stats
 * Used by comparison scripts to test local builds
 */

import { getPackageStats, getPackageExportSizes } from '../src/index'

async function run() {
  const packageString = process.argv[2]
  if (!packageString) {
    process.stderr.write('Error: No package specified\n')
    process.exit(1)
  }

  try {
    const stats = await getPackageStats(packageString, {})
    const exportSizes = await getPackageExportSizes(packageString, {})

    const result = {
      size: stats.size,
      gzip: stats.gzip,
      dependencyCount: stats.dependencyCount,
      dependencySizes: (stats as any).dependencySizes || [],
      assets: stats.assets,
      exports: exportSizes.assets.map((a: any) => ({
        name: a.name,
        size: a.size,
        gzip: a.gzip,
      })),
    }

    process.stdout.write('---RESULT_START---\n')
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.stdout.write('---RESULT_END---\n')
  } catch (error) {
    process.stderr.write('Analysis failed: ' + (error as any).message + '\n')
    process.exit(1)
  }
}

run()
