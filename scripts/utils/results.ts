/**
 * Results management and formatting
 */

import fs from 'fs'
import path from 'path'
import { config } from './config'

export interface ComparisonResult {
  package: string
  publishedVersion: string
  localVersion: string
  publishedStats: any
  localStats: any
  timestamp: string
  differences?: {
    sizeChange?: number
    sizeChangePercent?: number
    gzipChange?: number
    gzipChangePercent?: number
  }
}

/**
 * Create a timestamped results directory
 */
export function createResultsDir(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .split('T')[0] +
    '_' +
    new Date()
      .toTimeString()
      .split(' ')[0]
      .replace(/:/g, '')

  const resultDir = path.join(config.resultsDir, timestamp)
  fs.mkdirSync(resultDir, { recursive: true })

  return resultDir
}

/**
 * Save result to JSON file
 */
export function saveResult(resultDir: string, result: ComparisonResult): void {
  const filename = `${result.package.replace(/\//g, '-')}_result.json`
  const filepath = path.join(resultDir, filename)

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2))
}

/**
 * Calculate differences between published and local
 */
export function calculateDifferences(published: any, local: any) {
  const sizeChange = local.size - published.size
  const sizeChangePercent = (sizeChange / published.size) * 100
  const gzipChange = local.gzip - published.gzip
  const gzipChangePercent = (gzipChange / published.gzip) * 100

  return {
    sizeChange,
    sizeChangePercent,
    gzipChange,
    gzipChangePercent,
  }
}

/**
 * Format comparison results as markdown
 */
export function formatComparisonReport(results: ComparisonResult[]): string {
  const lines: string[] = [
    '# Package Comparison Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
  ]

  const summary = {
    totalPackages: results.length,
    improved: results.filter(r => r.differences?.sizeChange && r.differences.sizeChange < 0).length,
    regressed: results.filter(r => r.differences?.sizeChange && r.differences.sizeChange > 0).length,
    unchanged: results.filter(r => r.differences?.sizeChange === 0).length,
  }

  lines.push(`- Total Packages: ${summary.totalPackages}`)
  lines.push(`- Improved: ${summary.improved}`)
  lines.push(`- Regressed: ${summary.regressed}`)
  lines.push(`- Unchanged: ${summary.unchanged}`)
  lines.push('')

  lines.push('## Detailed Results')
  lines.push('')

  results.forEach(result => {
    const diff = result.differences
    const sizeIcon = diff && diff.sizeChange < 0 ? '📉' : diff && diff.sizeChange > 0 ? '📈' : '➡️'
    const gzipIcon = diff && diff.gzipChange < 0 ? '📉' : diff && diff.gzipChange > 0 ? '📈' : '➡️'

    lines.push(`### ${result.package}`)
    lines.push('')
    lines.push(
      `| Metric | Published | Local | Change |`,
    )
    lines.push(`|--------|-----------|-------|--------|`)
    lines.push(
      `| Size | ${result.publishedStats.size} | ${result.localStats.size} | ${sizeIcon} ${diff?.sizeChange}B (${diff?.sizeChangePercent.toFixed(2)}%) |`,
    )
    lines.push(
      `| Gzip | ${result.publishedStats.gzip} | ${result.localStats.gzip} | ${gzipIcon} ${diff?.gzipChange}B (${diff?.gzipChangePercent.toFixed(2)}%) |`,
    )
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * Save report to file
 */
export function saveReport(resultDir: string, results: ComparisonResult[]): void {
  const report = formatComparisonReport(results)
  const filepath = path.join(resultDir, 'report.md')
  fs.writeFileSync(filepath, report)
}
