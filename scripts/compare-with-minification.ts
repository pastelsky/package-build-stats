import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const LOCAL_DIR = process.cwd()
const ORIGINAL_DIR =
  process.env.ORIGINAL_DIR || '../package-build-stats-original'

interface ComparisonResult {
  package: string
  mode: 'minified' | 'unminified'
  local: {
    size: number
    gzip: number
    time: number
  } | null
  original: {
    size: number
    gzip: number
    time: number
  } | null
}

async function runAnalysis(
  dir: string,
  pkg: string,
  version: 'local' | 'original',
  minify: boolean,
): Promise<{ size: number; gzip: number; time: number } | null> {
  const startTime = Date.now()

  const runnerCode = `
const getPackageStats = require('./build/index.js').default || require('./build/getPackageStats.js').default;

(async () => {
  try {
    const result = await getPackageStats('${pkg}', { 
      debug: false,
      minify: ${minify}
    });
    
    console.log(JSON.stringify({
      size: result.size,
      gzip: result.gzip,
      time: ${Date.now()} - ${startTime}
    }));
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
`

  const runnerPath = path.join(
    dir,
    `tmp_compare_runner_${version}_${minify ? 'min' : 'unmin'}.js`,
  )
  fs.writeFileSync(runnerPath, runnerCode)

  return new Promise(resolve => {
    const child = spawn('node', [runnerPath], {
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

    child.on('close', () => {
      try {
        fs.unlinkSync(runnerPath)
      } catch (e) {}

      try {
        const match = stdout.match(/\{[^}]+\}/)
        if (match) {
          const result = JSON.parse(match[0])
          resolve(result)
        } else {
          console.error(
            `Failed to parse output for ${version} (minify=${minify})`,
          )
          console.error('Stderr:', stderr.substring(0, 200))
          resolve(null)
        }
      } catch (e) {
        console.error(
          `Error parsing result for ${version} (minify=${minify}):`,
          e,
        )
        resolve(null)
      }
    })
  })
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

async function comparePackage(pkg: string): Promise<void> {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📦 Analyzing: ${pkg}`)
  console.log('='.repeat(70))

  // Test 1: Both Minified (production mode)
  console.log('\n🔧 Test 1: BOTH MINIFIED (Production Mode)')
  console.log('-'.repeat(70))

  const [localMin, originalMin] = await Promise.all([
    runAnalysis(LOCAL_DIR, pkg, 'local', true),
    runAnalysis(ORIGINAL_DIR, pkg, 'original', true),
  ])

  if (localMin && originalMin) {
    console.log(
      `Local (Rspack+SWC):     ${formatBytes(localMin.size)} | Gzip: ${formatBytes(localMin.gzip)} | Time: ${formatTime(localMin.time)}`,
    )
    console.log(
      `Original (Webpack+Terser): ${formatBytes(originalMin.size)} | Gzip: ${formatBytes(originalMin.gzip)} | Time: ${formatTime(originalMin.time)}`,
    )

    const diff = originalMin.size - localMin.size
    const diffPercent = ((diff / originalMin.size) * 100).toFixed(1)
    console.log(
      `Difference: ${formatBytes(Math.abs(diff))} (${diffPercent}% ${diff > 0 ? 'smaller in Local' : 'larger in Local'})`,
    )
  } else {
    console.log('❌ One or both builds failed')
  }

  // Test 2: Both Unminified (debug mode)
  console.log('\n🔧 Test 2: BOTH UNMINIFIED (Debug Mode)')
  console.log('-'.repeat(70))

  const [localUnmin, originalUnmin] = await Promise.all([
    runAnalysis(LOCAL_DIR, pkg, 'local', false),
    runAnalysis(ORIGINAL_DIR, pkg, 'original', false),
  ])

  if (localUnmin && originalUnmin) {
    console.log(
      `Local (Rspack, no minify):     ${formatBytes(localUnmin.size)} | Gzip: ${formatBytes(localUnmin.gzip)} | Time: ${formatTime(localUnmin.time)}`,
    )
    console.log(
      `Original (Webpack, no minify): ${formatBytes(originalUnmin.size)} | Gzip: ${formatBytes(originalUnmin.gzip)} | Time: ${formatTime(originalUnmin.time)}`,
    )

    const diff = originalUnmin.size - localUnmin.size
    const diffPercent = ((diff / originalUnmin.size) * 100).toFixed(1)
    console.log(
      `Difference: ${formatBytes(Math.abs(diff))} (${diffPercent}% ${diff > 0 ? 'smaller in Local' : 'larger in Local'})`,
    )
  } else {
    console.log('❌ One or both builds failed')
  }

  // Summary
  console.log('\n📊 SUMMARY')
  console.log('-'.repeat(70))

  if (localMin && originalMin && localUnmin && originalUnmin) {
    const minifiedImpact = {
      local: (
        ((localUnmin.size - localMin.size) / localUnmin.size) *
        100
      ).toFixed(1),
      original: (
        ((originalUnmin.size - originalMin.size) / originalUnmin.size) *
        100
      ).toFixed(1),
    }

    console.log(`Minification Impact:`)
    console.log(
      `  Local:    ${minifiedImpact.local}% reduction (${formatBytes(localUnmin.size)} → ${formatBytes(localMin.size)})`,
    )
    console.log(
      `  Original: ${minifiedImpact.original}% reduction (${formatBytes(originalUnmin.size)} → ${formatBytes(originalMin.size)})`,
    )

    console.log(`\nConclusion:`)
    const minDiff = Math.abs(localMin.size - originalMin.size)
    const unminDiff = Math.abs(localUnmin.size - originalUnmin.size)

    if (minDiff < 5000 && unminDiff < 5000) {
      console.log(
        `  ✅ Both versions produce similar results when minification settings match`,
      )
    } else if (minDiff > 50000) {
      console.log(
        `  ⚠️  Significant difference even with same minification settings`,
      )
      console.log(
        `     This suggests bundler/tree-shaking differences beyond minification`,
      )
    } else {
      console.log(
        `  ℹ️  Moderate differences observed, likely due to minifier implementation`,
      )
    }
  }
}

async function main() {
  const pkg = process.argv[2] || 'rxjs'

  console.log(
    '\n╔════════════════════════════════════════════════════════════════╗',
  )
  console.log(
    '║       MINIFICATION COMPARISON: Local vs Original              ║',
  )
  console.log(
    '╚════════════════════════════════════════════════════════════════╝',
  )
  console.log(`\nPackage: ${pkg}`)
  console.log(`Local Dir:    ${LOCAL_DIR}`)
  console.log(`Original Dir: ${ORIGINAL_DIR}`)

  await comparePackage(pkg)

  console.log('\n' + '='.repeat(70))
  console.log('✅ Analysis Complete')
  console.log('='.repeat(70) + '\n')
}

main().catch(console.error)
