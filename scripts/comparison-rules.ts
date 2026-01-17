/**
 * Package Build Stats Comparison Rules
 *
 * This module codifies all comparison criteria and rules for determining
 * if package differences are significant enough to flag.
 */

/**
 * Represents metrics for comparing Local and Original versions
 */
export interface ComparisonMetrics {
  package: string
  localSize: number
  originalSize: number
  localExports: number
  originalExports: number
  localDeps: number
  originalDeps: number
  localDependencies: Array<{ name: string; approximateSize: number }>
  originalDependencies: Array<{ name: string; approximateSize: number }>
}

/**
 * Represents dependency share difference
 */
export interface DepShareDiff {
  name: string
  localShare: number
  originalShare: number
  diff: number
}

/**
 * Detailed breakdown of which rules triggered
 */
export interface ComparisonDetails {
  sizeFlag: boolean
  sizeDiff?: number
  sizePercent?: number
  exportFlag: boolean
  exportDiff?: number
  exportException?: boolean
  depCountFlag: boolean
  depCountDiff?: number
  depShareFlag: boolean
  depShareDifferences?: DepShareDiff[]
}

/**
 * Result of comparison significance check
 */
export interface ComparisonResult {
  package: string
  isSignificant: boolean
  reasons: string[]
  details: ComparisonDetails
}

/**
 * RULE 1: Bundle Size Comparison
 *
 * Threshold:
 * - Absolute difference: >= 10 KB
 * - AND (Percentage difference > 10% OR Absolute difference > 20 KB)
 *
 * @param localSize - Local bundle size in bytes
 * @param originalSize - Original bundle size in bytes
 * @returns Object with flag and metrics
 */
function checkBundleSize(localSize: number, originalSize: number) {
  const sizeDiff = Math.abs(localSize - originalSize)
  const sizePercent = (sizeDiff / Math.max(localSize, originalSize)) * 100

  const isSignificant =
    sizeDiff >= 10240 && (sizePercent > 10 || sizeDiff > 20480)

  return {
    flag: isSignificant,
    diff: sizeDiff,
    percent: sizePercent,
  }
}

/**
 * RULE 2: Export Count Comparison
 *
 * Threshold:
 * - Export count difference: > 5
 * - EXCEPTION: DO NOT flag if original=0 AND local>0
 *
 * @param localExports - Number of exports in Local version
 * @param originalExports - Number of exports in Original version
 * @returns Object with flag and metrics
 */
function checkExports(localExports: number, originalExports: number) {
  const exportDiff = Math.abs(localExports - originalExports)
  const isException = originalExports === 0 && localExports > 0

  const isSignificant = exportDiff > 5 && !isException

  return {
    flag: isSignificant,
    diff: exportDiff,
    isException,
  }
}

/**
 * RULE 3: Dependency Count Comparison
 *
 * Threshold:
 * - Dependency count difference: > 5
 *
 * @param localDeps - Number of dependencies in Local version
 * @param originalDeps - Number of dependencies in Original version
 * @returns Object with flag and metrics
 */
function checkDependencyCount(localDeps: number, originalDeps: number) {
  const depDiff = Math.abs(localDeps - originalDeps)
  const isSignificant = depDiff > 5

  return {
    flag: isSignificant,
    diff: depDiff,
  }
}

/**
 * Calculate relative dependency share (percentage of total)
 *
 * @param deps - Array of dependencies with sizes
 * @returns Map of dependency name to relative percentage
 */
export function calculateDependencyShares(
  deps: Array<{ name: string; approximateSize: number }>,
): Map<string, number> {
  const totalWeight = deps.reduce((sum, d) => sum + (d.approximateSize || 0), 0)
  const shares = new Map<string, number>()

  deps.forEach(dep => {
    const percentage =
      totalWeight > 0 ? ((dep.approximateSize || 0) / totalWeight) * 100 : 0
    shares.set(dep.name, percentage)
  })

  return shares
}

/**
 * RULE 4: Dependency Share Comparison
 *
 * Threshold:
 * - Any single dependency has >10% absolute difference in relative share
 * - Relative share = (dep.size / total_deps_size) * 100
 *
 * @param localDeps - Local version dependencies with sizes
 * @param originalDeps - Original version dependencies with sizes
 * @returns Object with flag and metrics
 */
function checkDependencyShares(
  localDeps: Array<{ name: string; approximateSize: number }>,
  originalDeps: Array<{ name: string; approximateSize: number }>,
) {
  const localShares = calculateDependencyShares(localDeps)
  const originalShares = calculateDependencyShares(originalDeps)

  const allDepNames = new Set([...localShares.keys(), ...originalShares.keys()])
  const differences: DepShareDiff[] = []

  allDepNames.forEach(depName => {
    const localShare = localShares.get(depName) || 0
    const originalShare = originalShares.get(depName) || 0
    const diff = Math.abs(localShare - originalShare)

    if (diff > 10) {
      differences.push({
        name: depName,
        localShare,
        originalShare,
        diff,
      })
    }
  })

  // Sort by difference descending
  differences.sort((a, b) => b.diff - a.diff)

  const isSignificant = differences.length > 0

  return {
    flag: isSignificant,
    differences,
  }
}

/**
 * Main comparison function
 *
 * Determines if package differences are significant based on all criteria.
 * A package is flagged if ANY rule triggers.
 *
 * @param metrics - Complete comparison metrics
 * @returns ComparisonResult with significance flag and detailed breakdown
 */
export function isSignificantDifference(
  metrics: ComparisonMetrics,
): ComparisonResult {
  const reasons: string[] = []
  const details: ComparisonDetails = {
    sizeFlag: false,
    exportFlag: false,
    depCountFlag: false,
    depShareFlag: false,
  }

  // Rule 1: Bundle Size
  const sizeCheck = checkBundleSize(metrics.localSize, metrics.originalSize)
  if (sizeCheck.flag) {
    details.sizeFlag = true
    details.sizeDiff = sizeCheck.diff
    details.sizePercent = sizeCheck.percent
    reasons.push(
      `Size: ${(sizeCheck.diff / 1024).toFixed(1)}KB (${sizeCheck.percent.toFixed(1)}%)`,
    )
  }

  // Rule 2: Exports
  const exportCheck = checkExports(
    metrics.localExports,
    metrics.originalExports,
  )
  if (exportCheck.flag) {
    details.exportFlag = true
    details.exportDiff = exportCheck.diff
    details.exportException = false
    reasons.push(`Exports: ${exportCheck.diff} diff`)
  }

  // Rule 3: Dependency Count
  const depCountCheck = checkDependencyCount(
    metrics.localDeps,
    metrics.originalDeps,
  )
  if (depCountCheck.flag) {
    details.depCountFlag = true
    details.depCountDiff = depCountCheck.diff
    reasons.push(`Deps: ${depCountCheck.diff} diff`)
  }

  // Rule 4: Dependency Share
  const depShareCheck = checkDependencyShares(
    metrics.localDependencies,
    metrics.originalDependencies,
  )
  if (depShareCheck.flag) {
    details.depShareFlag = true
    details.depShareDifferences = depShareCheck.differences
    reasons.push(`Dep share differences`)
  }

  // Package is significant if ANY rule triggers
  const isSignificant =
    details.sizeFlag ||
    details.exportFlag ||
    details.depCountFlag ||
    details.depShareFlag

  return {
    package: metrics.package,
    isSignificant,
    reasons,
    details,
  }
}

/**
 * Batch comparison for multiple packages
 *
 * @param metricsArray - Array of metrics for multiple packages
 * @returns Array of results filtered to only significant differences
 */
export function comparePackages(
  metricsArray: ComparisonMetrics[],
): ComparisonResult[] {
  return metricsArray
    .map(metrics => isSignificantDifference(metrics))
    .filter(result => result.isSignificant)
}

/**
 * Generate summary statistics from comparison results
 *
 * @param results - Array of comparison results
 * @returns Summary statistics
 */
export function generateSummary(results: ComparisonResult[]) {
  const total = results.length
  const significant = results.filter(r => r.isSignificant).length

  const breakdown = {
    size: results.filter(r => r.details.sizeFlag).length,
    exports: results.filter(r => r.details.exportFlag).length,
    depCount: results.filter(r => r.details.depCountFlag).length,
    depShare: results.filter(r => r.details.depShareFlag).length,
  }

  return {
    totalAnalyzed: total,
    significantDifferences: significant,
    matchingCriteria: total - significant,
    compatibilityPercent: (((total - significant) / total) * 100).toFixed(1),
    breakdown,
  }
}

// Export all functions and types
export {
  checkBundleSize,
  checkExports,
  checkDependencyCount,
  checkDependencyShares,
}
