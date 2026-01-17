#!/usr/bin/env node

/**
 * Performance Testing & Profiling Script
 * Tests package-build-stats with the 'three' package
 * Includes detailed timing breakdowns for all operations
 */

import { performance } from 'perf_hooks'
import { rimraf } from 'rimraf'
import path from 'path'
import { config } from './utils/config'
import { logger } from './utils/logger'
import { getPackageStats, getPackageExportSizes } from '../src/index'

interface TimingBreakdown {
  operation: string
  duration: number
  percentage?: number
}

const timings: TimingBreakdown[] = []

function startTimer(operation: string): { end: () => void } {
  const start = performance.now()
  logger.info(`[TIMER] Starting: ${operation}`)

  return {
    end() {
      const duration = performance.now() - start
      timings.push({ operation, duration })
      logger.success(
        `[TIMER] Completed: ${operation} - ${duration.toFixed(2)}ms`,
      )
    },
  }
}

async function clearCache(): Promise<void> {
  const timer = startTimer('Cache Cleanup')

  try {
    await rimraf(config.cacheDir)
    logger.info(`Cache cleared: ${config.cacheDir}`)
  } catch (error) {
    logger.warning(`Could not clear cache: ${(error as Error).message}`)
  }

  timer.end()
}

async function performanceTest(): Promise<void> {
  const overallStart = performance.now()

  logger.box('Performance Testing: three.js Package', 'blue')
  logger.blank()

  logger.info('Test Configuration:')
  console.log(`  Package: three`)
  console.log(`  Cache Directory: ${config.cacheDir}`)
  console.log(`  Concurrency: ${config.concurrency}`)
  console.log(`  Timeout: ${config.timeout}ms`)
  logger.blank()

  // Phase 1: Clear Cache
  logger.divider('green')
  logger.info('PHASE 1: Cache Cleanup')
  logger.divider('green')
  logger.blank()

  await clearCache()
  logger.blank()

  // Phase 2: Get Package Stats
  logger.divider('blue')
  logger.info('PHASE 2: Get Package Statistics')
  logger.divider('blue')
  logger.blank()

  let stats: any
  try {
    const timer = startTimer('getPackageStats(three)')
    stats = await getPackageStats('three', {})
    timer.end()

    logger.blank()
    logger.success('Package Stats Retrieved:')
    console.log(`  • Size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
    console.log(`  • Gzip: ${stats.gzip} bytes (${(stats.gzip / 1024 / 1024).toFixed(2)} MB)`)
    console.log(`  • Dependency Count: ${stats.dependencyCount}`)
    if (stats.assets && Array.isArray(stats.assets)) {
      console.log(`  • Assets Count: ${stats.assets.length}`)
    }
    logger.blank()
  } catch (error) {
    logger.error(`Failed to get package stats: ${(error as Error).message}`)
    throw error
  }

  // Phase 3: Get Export Sizes
  logger.divider('cyan')
  logger.info('PHASE 3: Get Export Sizes')
  logger.divider('cyan')
  logger.blank()

  let exportSizes: any
  try {
    const timer = startTimer('getPackageExportSizes(three)')
    exportSizes = await getPackageExportSizes('three', {})
    timer.end()

    logger.blank()
    logger.success('Export Sizes Retrieved:')
    if (exportSizes.assets && Array.isArray(exportSizes.assets)) {
      console.log(`  • Export Assets Count: ${exportSizes.assets.length}`)
      console.log(`  • First 5 exports:`)
      exportSizes.assets.slice(0, 5).forEach((asset: any, i: number) => {
        console.log(
          `    ${i + 1}. ${asset.name}: ${asset.size} bytes (gzip: ${asset.gzip} bytes)`,
        )
      })
    }
    logger.blank()
  } catch (error) {
    logger.error(`Failed to get export sizes: ${(error as Error).message}`)
    throw error
  }

  // Phase 4: Dependency Analysis
  logger.divider('yellow')
  logger.info('PHASE 4: Dependency Analysis')
  logger.divider('yellow')
  logger.blank()

  if (stats.dependencySizes && Array.isArray(stats.dependencySizes)) {
    logger.info(`Dependencies Found: ${stats.dependencySizes.length}`)
    console.log('  Top 10 Dependencies by Size:')
    stats.dependencySizes
      .slice(0, 10)
      .forEach(
        (dep: any, i: number) =>
          console.log(
            `    ${i + 1}. ${dep.name}: ${(dep.approximateSize / 1024).toFixed(2)} KB`,
          ),
      )
  }
  logger.blank()

  // Phase 5: Summary & Timing Breakdown
  logger.divider('green')
  logger.info('TIMING BREAKDOWN')
  logger.divider('green')
  logger.blank()

  const totalDuration = performance.now() - overallStart
  const sortedTimings = timings.sort((a, b) => b.duration - a.duration)

  logger.info('Operation Timings (sorted by duration):')
  logger.blank()

  sortedTimings.forEach((timing, i) => {
    const percentage = ((timing.duration / totalDuration) * 100).toFixed(1)
    const bar = '█'.repeat(Math.round(parseInt(percentage) / 5))
    console.log(
      `  ${i + 1}. ${timing.operation.padEnd(35)} ${timing.duration.toFixed(2).padStart(8)}ms (${percentage.padStart(5)}%) ${bar}`,
    )
  })

  logger.blank()
  logger.box(`Total Time: ${totalDuration.toFixed(2)}ms`, 'green')
  logger.blank()

  // Phase 6: Final Summary
  logger.divider('blue')
  logger.info('SUMMARY')
  logger.divider('blue')
  logger.blank()

  const cacheWarning = stats.installPath
    ? `Install Path: ${stats.installPath}`
    : 'No install path'

  logger.info('Package Information:')
  console.log(`  • Package: three`)
  console.log(`  • Version: ${stats.version || 'unknown'}`)
  console.log(`  • ${cacheWarning}`)
  logger.blank()

  logger.info('Size Information:')
  console.log(`  • Uncompressed: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  • Gzip: ${(stats.gzip / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  • Compression Ratio: ${((1 - stats.gzip / stats.size) * 100).toFixed(1)}%`)
  logger.blank()

  logger.info('Performance:')
  console.log(`  • Total Execution Time: ${totalDuration.toFixed(2)}ms`)
  console.log(`  • Slowest Operation: ${sortedTimings[0].operation} (${sortedTimings[0].duration.toFixed(2)}ms)`)
  console.log(`  • Number of Operations: ${timings.length}`)
  logger.blank()

  logger.success('Performance test completed successfully!')
  logger.blank()
}

// Run the test
performanceTest().catch(error => {
  logger.error(`Performance test failed: ${error.message}`)
  process.exit(1)
})
