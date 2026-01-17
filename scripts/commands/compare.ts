/**
 * COMPARE command - Compare published vs local with options
 */

import { logger } from '../utils/logger'
import { comparePackagesParallel, comparePackageWithMinification } from '../utils/runner'
import { createResultsDir, saveResult, saveReport, calculateDifferences } from '../utils/results'
import { config } from '../utils/config'

export async function compareCommand(
  packages: string[],
  options: Record<string, any>,
): Promise<void> {
  logger.box('Package Comparison: Published vs Local', 'blue')
  logger.blank()

  const concurrency = options.concurrency ? parseInt(options.concurrency, 10) : config.concurrency
  const withMinification = options.minification === 'true' || options.minification === true
  const exportSizes = options.exports === 'true' || options.exports === true

  logger.info(`Testing ${packages.length} package(s)`)
  logger.info(`Concurrency: ${concurrency} at a time`)
  if (withMinification) {
    logger.info('Comparison: With minification enabled')
  }
  if (exportSizes) {
    logger.info('Includes: Export size analysis')
  }
  logger.blank()

  logger.divider()
  logger.info('Starting comparison tests...')
  logger.divider()
  logger.blank()

  const resultDir = createResultsDir()

  let results
  if (withMinification) {
    // Compare with minification option
    results = await Promise.all(
      packages.map(pkg =>
        comparePackageWithMinification(pkg, true)
          .then(({ published, local }) => ({ package: pkg, published, local }))
          .catch(error => ({
            package: pkg,
            published: {} as any,
            local: {} as any,
            error: error.message,
          })),
      ),
    )
  } else {
    // Standard parallel comparison
    results = await comparePackagesParallel(packages, concurrency)
  }

  logger.blank()
  logger.divider('green')
  logger.success('All package tests completed!')
  logger.divider('green')
  logger.blank()

  // Process and save results
  const comparisonResults = results
    .filter(r => !r.error)
    .map(r => ({
      package: r.package,
      publishedVersion: 'latest',
      localVersion: 'HEAD',
      publishedStats: r.published,
      localStats: r.local,
      timestamp: new Date().toISOString(),
      differences: calculateDifferences(r.published, r.local),
    }))

  comparisonResults.forEach(result => saveResult(resultDir, result))
  saveReport(resultDir, comparisonResults)

  logger.box('Comparison Complete!', 'green')
  logger.blank()
  logger.info(`Results directory: ${resultDir}`)
  logger.info(`Report: ${resultDir}/report.md`)
  logger.blank()

  // Show summary
  const improved = comparisonResults.filter(r => r.differences!.sizeChange < 0).length
  const regressed = comparisonResults.filter(r => r.differences!.sizeChange > 0).length
  const unchanged = comparisonResults.filter(r => r.differences!.sizeChange === 0).length
  const failed = results.filter(r => r.error).length

  logger.info('SUMMARY:')
  console.log(`  Improved:  ${improved} packages (smaller size)`)
  console.log(`  Regressed: ${regressed} packages (larger size)`)
  console.log(`  Unchanged: ${unchanged} packages`)
  if (failed > 0) {
    console.log(`  Failed:    ${failed} packages`)
  }
  logger.blank()

  if (options.json) {
    console.log(JSON.stringify(comparisonResults, null, 2))
  }
}
