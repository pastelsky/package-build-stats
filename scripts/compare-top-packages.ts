import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  isSignificantDifference,
  comparePackages,
  generateSummary,
  type ComparisonMetrics,
  type ComparisonResult,
} from './comparison-rules'

const LOCAL_DIR = process.cwd()
const ORIGINAL_DIR =
  process.env.ORIGINAL_DIR || '../package-build-stats-original'
const REPORTS_DIR = path.join(LOCAL_DIR, 'reports')

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
}

function colorize(text: string, ...codes: string[]): string {
  return codes.join('') + text + colors.reset
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function percentDiff(local: number, original: number): string {
  if (original === 0) return 'N/A'
  const diff = (((local - original) / original) * 100).toFixed(1)
  const sign = parseFloat(diff) >= 0 ? '+' : ''
  return `${sign}${diff}%`
}

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
}

const packages = JSON.parse(
  fs.readFileSync(
    path.join(LOCAL_DIR, 'scripts/top-100-recent-packages.json'),
    'utf8',
  ),
)

interface TimingInfo {
  statsTimeMs: number
  exportsTimeMs: number
  totalTimeMs: number
}

interface AnalysisResult {
  size: number
  gzip: number
  dependencySizes: any[]
  exports: any[]
  timing?: TimingInfo
  installPath?: string
}

interface SummaryItem {
  pkg: string
  status?: string
  sizeStatus?: string
  depsStatus?: string
  exportsStatus?: string
  localSize?: number
  originalSize?: number
  localTimeMs?: number
  originalTimeMs?: number
}

function runAnalysis(
  dir: string,
  pkg: string,
  label: string,
): Promise<AnalysisResult | null> {
  const startTime = Date.now()
  const pkgSafeName = pkg.replace(/\//g, '__')
  const pkgDir = path.join(REPORTS_DIR, pkgSafeName)
  const logDir = path.join(pkgDir, label.toLowerCase())
  fs.mkdirSync(logDir, { recursive: true })

  console.log(`Analyzing ${pkg} in ${dir}`)

  // Clean potential previous build output
  const distPath = path.join(dir, 'dist')
  if (fs.existsSync(distPath)) {
    try {
      fs.rmSync(distPath, { recursive: true, force: true })
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  return new Promise(resolve => {
    const child = spawn('node', [path.join(dir, 'scripts/runner.js'), pkg], {
      cwd: dir,
      env: { ...process.env, NODE_OPTIONS: '--openssl-legacy-provider' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      stderr += `\n[Internal Script Error]: ${error.message}\n${error.stack || ''}`
    })

    child.on('close', () => {
      // Write logs
      fs.writeFileSync(path.join(logDir, 'stdout.log'), stdout || '')
      fs.writeFileSync(path.join(logDir, 'stderr.log'), stderr || '')

      // Copy dist if it was created (even if runner failed, maybe partial build?)
      if (fs.existsSync(distPath)) {
        try {
          fs.cpSync(distPath, path.join(logDir, 'dist'), { recursive: true })
        } catch (e) {
          console.error(`Failed to copy dist for ${pkg}:`, e)
        }
      }

      const match = stdout.match(/---RESULT_START---([\s\S]*?)---RESULT_END---/)
      if (match) {
        const parsedResult = JSON.parse(match[1])
        const elapsed = Date.now() - startTime
        console.log(
          `    ${colorize('✓', colors.green)} ${label}: ${colorize(formatTime(elapsed), colors.cyan)}`,
        )

        // Capture build artifacts (install path) if available
        if (
          parsedResult.installPath &&
          fs.existsSync(parsedResult.installPath)
        ) {
          try {
            const destBuildPath = path.join(logDir, 'source') // Renamed to 'source' as it's the source code (node_modules)
            // fs.cpSync is available in Node 16.7+
            fs.cpSync(parsedResult.installPath, destBuildPath, {
              recursive: true,
            })

            // Clean up the temp dir since we used debug: true
            fs.rmSync(parsedResult.installPath, {
              recursive: true,
              force: true,
            })
          } catch (e) {
            console.error(`Failed to copy source artifacts for ${pkg}:`, e)
          }
        }

        resolve(parsedResult)
      } else {
        const elapsed = Date.now() - startTime
        console.log(
          `    ${colorize('✗', colors.red)} ${label}: ${colorize('FAILED', colors.red)} (${formatTime(elapsed)})`,
        )
        if (stderr) {
          fs.appendFileSync(
            path.join(logDir, 'stderr.log'),
            `\n[Runner stderr]: ${stderr}`,
          )
        }
        resolve(null)
      }
    })
  })
}

function compareDeps(local: any[], original: any[]) {
  const localMap = new Map(local.map(d => [d.name, d.approximateSize]))
  const originalMap = new Map(original.map(d => [d.name, d.approximateSize]))

  const added = [...localMap.keys()].filter(k => !originalMap.has(k))
  const removed = [...originalMap.keys()].filter(k => !localMap.has(k))

  let sizeDiff = 0
  const items: any[] = []

  for (const [name, size] of localMap) {
    const origSize = originalMap.get(name)
    if (origSize !== undefined) {
      const diff = size - (origSize as number)
      sizeDiff += Math.abs(diff)
      items.push({ name, local: size, original: origSize, diff })
    }
  }

  return { added, removed, sizeDiff, items }
}

function compareExports(local: any[], original: any[]) {
  const localMap = new Map(local.map(e => [e.name, e.size]))
  const originalMap = new Map(original.map(e => [e.name, e.size]))

  const added = [...localMap.keys()].filter(k => !originalMap.has(k))
  const removed = [...originalMap.keys()].filter(k => !localMap.has(k))

  let sizeDiff = 0
  for (const [name, size] of localMap) {
    const origSize = originalMap.get(name)
    if (origSize !== undefined) {
      sizeDiff += Math.abs(size - (origSize as number))
    }
  }

  return {
    added,
    removed,
    sizeDiff,
    localCount: local.length,
    originalCount: original.length,
  }
}

function getRatingColor(rating: string): string {
  switch (rating) {
    case 'Match':
      return colors.green
    case 'Medium':
      return colors.yellow
    case 'Significant':
      return colors.red
    default:
      return colors.reset
  }
}

function printSeparator() {
  console.log(colorize('─'.repeat(60), colors.dim))
}

function getDepsDescription(depsComp: ReturnType<typeof compareDeps>): string {
  const parts: string[] = []
  if (depsComp.added.length > 0) {
    parts.push(
      `+${depsComp.added.length} new: ${depsComp.added.slice(0, 2).join(', ')}${depsComp.added.length > 2 ? '...' : ''}`,
    )
  }
  if (depsComp.removed.length > 0) {
    parts.push(
      `-${depsComp.removed.length} removed: ${depsComp.removed.slice(0, 2).join(', ')}${depsComp.removed.length > 2 ? '...' : ''}`,
    )
  }
  if (parts.length === 0 && depsComp.sizeDiff > 0) {
    parts.push(`size diff: ${formatBytes(depsComp.sizeDiff)}`)
  }
  if (parts.length === 0) {
    parts.push('identical')
  }
  return parts.join(', ')
}

function getExportsDescription(
  exportsComp: ReturnType<typeof compareExports>,
): string {
  const parts: string[] = []
  if (exportsComp.added.length > 0) {
    parts.push(
      `+${exportsComp.added.length} new: ${exportsComp.added.slice(0, 2).join(', ')}${exportsComp.added.length > 2 ? '...' : ''}`,
    )
  }
  if (exportsComp.removed.length > 0) {
    parts.push(
      `-${exportsComp.removed.length} removed: ${exportsComp.removed.slice(0, 2).join(', ')}${exportsComp.removed.length > 2 ? '...' : ''}`,
    )
  }
  if (parts.length === 0 && exportsComp.sizeDiff > 0) {
    parts.push(`size diff: ${formatBytes(exportsComp.sizeDiff)}`)
  }
  if (parts.length === 0) {
    if (exportsComp.localCount === 0 && exportsComp.originalCount === 0) {
      parts.push('no exports')
    } else if (exportsComp.localCount === exportsComp.originalCount) {
      parts.push(`${exportsComp.localCount} exports, identical`)
    } else {
      parts.push(
        `local: ${exportsComp.localCount}, original: ${exportsComp.originalCount}`,
      )
    }
  }
  return parts.join(', ')
}

async function main() {
  const summary: SummaryItem[] = []

  // Process top 20 packages - can configure start/end indices via env vars
  const startIdx = parseInt(process.env.START_IDX || '0', 10)
  const endIdx = parseInt(process.env.END_IDX || '20', 10)
  const concurrency = parseInt(process.env.CONCURRENCY || '3', 10)
  const subset = packages.slice(startIdx, endIdx)

  console.log('')
  console.log(
    colorize(
      '╔══════════════════════════════════════════════════════════╗',
      colors.cyan,
    ),
  )
  console.log(
    colorize('║', colors.cyan) +
      colorize(
        '  PACKAGE BUILD STATS - COMPARISON REPORT  ',
        colors.bold,
        colors.cyan,
      ) +
      colorize('               ║', colors.cyan),
  )
  console.log(
    colorize(
      '╚══════════════════════════════════════════════════════════╝',
      colors.cyan,
    ),
  )
  console.log('')
  console.log(
    `  ${colorize('Packages to analyze:', colors.dim)} ${subset.length}`,
  )
  console.log(`  ${colorize('Local version:', colors.dim)} ${LOCAL_DIR}`)
  console.log(`  ${colorize('Original version:', colors.dim)} ${ORIGINAL_DIR}`)
  console.log(`  ${colorize('Concurrency:', colors.dim)} ${concurrency}`)
  console.log('')
  printSeparator()

  const results: Array<SummaryItem | undefined> = new Array(subset.length)
  let nextIndex = 0

  const processPackage = async (pkg: string, index: number) => {
    const pkgSafeName = pkg.replace(/\//g, '__')
    console.log('')
    console.log(
      `${colorize(`[${startIdx + index + 1}/${endIdx}]`, colors.bold, colors.blue)} ${colorize(pkg, colors.bold)}`,
    )

    const local = await runAnalysis(LOCAL_DIR, pkg, 'Local')
    const original = await runAnalysis(ORIGINAL_DIR, pkg, 'Original')

    if (!local || !original) {
      console.log(
        `    ${colorize('→ Result:', colors.dim)} ${colorize('FAILED', colors.bgRed, colors.bold)}`,
      )
      printSeparator()
      return { pkg, status: 'FAILED' } as SummaryItem
    }

    const localTimeMs = local.timing?.totalTimeMs || 0
    const originalTimeMs = original.timing?.totalTimeMs || 0

    const depsComp = compareDeps(
      local.dependencySizes || [],
      original.dependencySizes || [],
    )
    const exportsComp = compareExports(
      local.exports || [],
      original.exports || [],
    )

    // Use new comparison rules
    const metrics: ComparisonMetrics = {
      package: pkg,
      localSize: local.size,
      originalSize: original.size,
      localExports: local.exports?.length || 0,
      originalExports: original.exports?.length || 0,
      localDeps: local.dependencySizes?.length || 0,
      originalDeps: original.dependencySizes?.length || 0,
      localDependencies: local.dependencySizes || [],
      originalDependencies: original.dependencySizes || [],
    }

    const comparisonResult = isSignificantDifference(metrics)

    // Map to old status format for display
    const sizeStatus = comparisonResult.details.sizeFlag
      ? 'Significant'
      : 'Match'
    const depsStatus =
      comparisonResult.details.depCountFlag ||
      comparisonResult.details.depShareFlag
        ? 'Significant'
        : 'Match'
    const exportsStatus = comparisonResult.details.exportFlag
      ? 'Significant'
      : 'Match'

    const overallStatus: SummaryItem = {
      pkg,
      sizeStatus,
      depsStatus,
      exportsStatus,
      localSize: local.size,
      originalSize: original.size,
      localTimeMs,
      originalTimeMs,
    }

    // Print summary for this package
    const depsDesc = getDepsDescription(depsComp)
    const exportsDesc = getExportsDescription(exportsComp)

    console.log(
      `    ${colorize('→ Size:', colors.dim)} Local ${colorize(formatBytes(local.size), colors.cyan)} | Original ${colorize(formatBytes(original.size), colors.cyan)} | ${colorize(sizeStatus, getRatingColor(sizeStatus))}`,
    )
    console.log(
      `    ${colorize('→ Deps:', colors.dim)} ${colorize(depsStatus, getRatingColor(depsStatus))} (${depsDesc})`,
    )
    console.log(
      `    ${colorize('→ Exports:', colors.dim)} ${colorize(exportsStatus, getRatingColor(exportsStatus))} (${exportsDesc})`,
    )

    // Show comparison rules results
    if (comparisonResult.reasons.length > 0) {
      console.log(
        `    ${colorize('→ Rules:', colors.dim)} ${colorize(comparisonResult.reasons.join(', '), colors.magenta)}`,
      )
    }

    if (localTimeMs && originalTimeMs) {
      const speedDiff = originalTimeMs - localTimeMs
      const speedPercent = Math.abs((speedDiff / originalTimeMs) * 100).toFixed(
        1,
      )
      const isFaster = speedDiff > 0
      const speedLabel = isFaster ? 'faster' : 'slower'
      const speedColor = isFaster ? colors.green : colors.red
      console.log(
        `    ${colorize('→ Speed:', colors.dim)} ${colorize(`${speedPercent}% ${speedLabel}`, speedColor)} (${formatTime(localTimeMs)} vs ${formatTime(originalTimeMs)})`,
      )
    }

    // Generate detailed report
    const report = `# Report for ${pkg}

## Comparison Rules Analysis

${comparisonResult.isSignificant ? '⚠️ **Significant Differences Detected**' : '✅ **No Significant Differences**'}

${comparisonResult.reasons.length > 0 ? `**Reasons:** ${comparisonResult.reasons.join(', ')}\n` : ''}

**Details:**
- Bundle Size: ${comparisonResult.details.sizeFlag ? '❌ Flagged' : '✅ Pass'}${comparisonResult.details.sizeDiff ? ` (${(comparisonResult.details.sizeDiff / 1024).toFixed(1)}KB, ${comparisonResult.details.sizePercent?.toFixed(1)}%)` : ''}
- Exports: ${comparisonResult.details.exportFlag ? '❌ Flagged' : '✅ Pass'}${comparisonResult.details.exportDiff ? ` (${comparisonResult.details.exportDiff} diff)` : ''}${comparisonResult.details.exportException ? ' (exception: orig=0, local>0)' : ''}
- Dependency Count: ${comparisonResult.details.depCountFlag ? '❌ Flagged' : '✅ Pass'}${comparisonResult.details.depCountDiff ? ` (${comparisonResult.details.depCountDiff} diff)` : ''}
- Dependency Share: ${comparisonResult.details.depShareFlag ? '❌ Flagged' : '✅ Pass'}${comparisonResult.details.depShareDifferences && comparisonResult.details.depShareDifferences.length > 0 ? ` (${comparisonResult.details.depShareDifferences.length} deps)` : ''}

${
  comparisonResult.details.depShareDifferences &&
  comparisonResult.details.depShareDifferences.length > 0
    ? `
**Dependency Share Differences (>10% absolute):**
${comparisonResult.details.depShareDifferences.map(d => `- **${d.name}**: Local ${d.localShare.toFixed(2)}% vs Original ${d.originalShare.toFixed(2)}% (diff: ${d.diff.toFixed(2)}%)`).join('\n')}
`
    : ''
}

---

## Overall Size
| Metric | Local | Original | Difference |
|--------|-------|----------|------------|
| Size | ${formatBytes(local.size)} | ${formatBytes(original.size)} | ${formatBytes(local.size - original.size)} (${percentDiff(local.size, original.size)}) |
| Gzip | ${formatBytes(local.gzip)} | ${formatBytes(original.gzip)} | ${formatBytes(local.gzip - original.gzip)} |

## Timing
| Metric | Local | Original | Speedup |
|--------|-------|----------|---------|
| Stats Analysis | ${formatTime(local.timing?.statsTimeMs || 0)} | ${formatTime(original.timing?.statsTimeMs || 0)} | ${percentDiff(original.timing?.statsTimeMs || 0, local.timing?.statsTimeMs || 0)} |
| Export Analysis | ${formatTime(local.timing?.exportsTimeMs || 0)} | ${formatTime(original.timing?.exportsTimeMs || 0)} | ${percentDiff(original.timing?.exportsTimeMs || 0, local.timing?.exportsTimeMs || 0)} |
| Total | ${formatTime(local.timing?.totalTimeMs || 0)} | ${formatTime(original.timing?.totalTimeMs || 0)} | ${percentDiff(original.timing?.totalTimeMs || 0, local.timing?.totalTimeMs || 0)} |

## Dependencies
- **Added:** ${depsComp.added.join(', ') || 'None'}
- **Removed:** ${depsComp.removed.join(', ') || 'None'}
- **Size Diff (common):** ${formatBytes(depsComp.sizeDiff)}

## Exports
- **Added:** ${exportsComp.added.join(', ') || 'None'}
- **Removed:** ${exportsComp.removed.join(', ') || 'None'}
- **Count:** Local: ${local.exports.length} | Original: ${original.exports.length}
- **Size Diff:** ${formatBytes(exportsComp.sizeDiff)}
`
    const pkgReportDir = path.join(REPORTS_DIR, pkgSafeName)
    fs.writeFileSync(path.join(pkgReportDir, 'comparison.md'), report)

    // Also save raw JSON for detail
    fs.writeFileSync(
      path.join(pkgReportDir, 'comparison.json'),
      JSON.stringify({ local, original }, null, 2),
    )

    printSeparator()
    return overallStatus
  }

  const worker = async () => {
    while (true) {
      const index = nextIndex++
      if (index >= subset.length) return
      results[index] = await processPackage(subset[index], index)
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () =>
    worker(),
  )
  await Promise.all(workers)

  for (const item of results) {
    if (!item) continue
    summary.push(item)
  }

  // Stats tracking
  let successCount = 0
  let failCount = 0
  let totalLocalTime = 0
  let totalOriginalTime = 0

  for (const item of summary) {
    if (item.status === 'FAILED') {
      failCount++
      continue
    }
    successCount++
    totalLocalTime += item.localTimeMs || 0
    totalOriginalTime += item.originalTimeMs || 0
  }

  // Print final summary
  console.log('')
  console.log(
    colorize(
      '╔══════════════════════════════════════════════════════════╗',
      colors.magenta,
    ),
  )
  console.log(
    colorize('║', colors.magenta) +
      colorize(
        '                    FINAL SUMMARY                         ',
        colors.bold,
        colors.magenta,
      ) +
      colorize('║', colors.magenta),
  )
  console.log(
    colorize(
      '╚══════════════════════════════════════════════════════════╝',
      colors.magenta,
    ),
  )
  console.log('')
  console.log(
    `  ${colorize('Success:', colors.green)} ${successCount}/${subset.length} packages`,
  )
  console.log(
    `  ${colorize('Failed:', colors.red)} ${failCount}/${subset.length} packages`,
  )
  console.log('')
  console.log(
    `  ${colorize('Total Local Time:', colors.dim)} ${formatTime(totalLocalTime)}`,
  )
  console.log(
    `  ${colorize('Total Original Time:', colors.dim)} ${formatTime(totalOriginalTime)}`,
  )
  if (totalOriginalTime > 0) {
    const overallSpeedup = (
      ((totalOriginalTime - totalLocalTime) / totalOriginalTime) *
      100
    ).toFixed(1)
    console.log(
      `  ${colorize('Overall Speedup:', colors.bold)} ${colorize(overallSpeedup + '%', colors.green)}`,
    )
  }
  console.log('')

  // Generate summary markdown
  let summaryMd = `# Overall Comparison Report

## Summary Statistics
| Metric | Value |
|--------|-------|
| Packages Analyzed | ${subset.length} |
| Successful | ${successCount} |
| Failed | ${failCount} |
| Total Local Time | ${formatTime(totalLocalTime)} |
| Total Original Time | ${formatTime(totalOriginalTime)} |
| Overall Speedup | ${totalOriginalTime > 0 ? (((totalOriginalTime - totalLocalTime) / totalOriginalTime) * 100).toFixed(1) + '%' : 'N/A'} |

## Detailed Results

| Package | Size Status | Dependencies | Exports | Local Size | Original Size | Local Time | Original Time |
| :--- | :---: | :---: | :---: | ---: | ---: | ---: | ---: |
`

  for (const s of summary) {
    if (s.status === 'FAILED') {
      summaryMd += `| ${s.pkg} | ❌ FAILED | - | - | - | - | - | - |\n`
    } else {
      const sizeEmoji =
        s.sizeStatus === 'Match'
          ? '✅'
          : s.sizeStatus === 'Medium'
            ? '⚠️'
            : '❌'
      const depsEmoji =
        s.depsStatus === 'Match'
          ? '✅'
          : s.depsStatus === 'Medium'
            ? '⚠️'
            : '❌'
      const exportsEmoji =
        s.exportsStatus === 'Match'
          ? '✅'
          : s.exportsStatus === 'Medium'
            ? '⚠️'
            : '❌'
      summaryMd += `| ${s.pkg} | ${sizeEmoji} ${s.sizeStatus} | ${depsEmoji} ${s.depsStatus} | ${exportsEmoji} ${s.exportsStatus} | ${formatBytes(s.localSize!)} | ${formatBytes(s.originalSize!)} | ${formatTime(s.localTimeMs!)} | ${formatTime(s.originalTimeMs!)} |\n`
    }
  }

  summaryMd += `
## Legend & Comparison Rules

### Status Indicators
- ✅ **Match**: All comparison rules pass
- ⚠️ **Medium**: Minor differences detected (deprecated - for compatibility)
- ❌ **Significant**: Comparison rules flagged significant differences

### Comparison Rules Applied
The following rules determine if a package has significant differences:

1. **Bundle Size**: Flagged if (≥10KB) AND (>10% OR >20KB difference)
2. **Exports**: Flagged if >5 exports differ (ignore if Original=0, Local>0)
3. **Dependencies**: Flagged if >5 dependencies differ
4. **Dependency Share**: Flagged if >10% absolute difference in any dep's relative weight

See [COMPARISON_CRITERIA.md](../COMPARISON_CRITERIA.md) for complete rules documentation.
`

  fs.writeFileSync(path.join(REPORTS_DIR, 'summary-report.md'), summaryMd)
  console.log(
    `${colorize('✓', colors.green)} Reports generated in ${colorize('reports/', colors.cyan)}`,
  )
  console.log('')
}

main().catch(console.error)
