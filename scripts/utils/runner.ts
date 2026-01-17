/**
 * Package stats execution utility
 * Handles running package-build-stats against published and local versions
 */

import { spawn } from 'child_process'
import path from 'path'
import { config } from './config'
import { logger } from './logger'

export interface PackageStats {
  size: number
  gzip: number
  dependencyCount: number
  dependencySizes?: Array<{ name: string; approximateSize: number }>
  assets: Array<{ name: string; type: string; size: number; gzip: number }>
}

/**
 * Run package-build-stats on a package using the published npm version
 */
export async function runPublished(packageName: string): Promise<PackageStats> {
  return new Promise((resolve, reject) => {
    const script = `
      const pkg = require('package-build-stats');
      (async () => {
        try {
          const stats = await pkg.getPackageStats('${packageName}');
          console.log('---RESULT_START---');
          console.log(JSON.stringify(stats, null, 2));
          console.log('---RESULT_END---');
        } catch (error) {
          console.error('Error:', error.message);
          process.exit(1);
        }
      })();
    `

    const child = spawn('node', ['-e', script], {
      cwd: config.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', data => {
      stdout += data.toString()
    })

    child.stderr.on('data', data => {
      stderr += data.toString()
    })

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Published test failed: ${stderr}`))
        return
      }

      const match = stdout.match(/---RESULT_START---([\s\S]*?)---RESULT_END---/)
      if (!match) {
        reject(new Error('Failed to parse published results'))
        return
      }

      try {
        const result = JSON.parse(match[1].trim())
        resolve(result)
      } catch (error) {
        reject(new Error('Failed to parse JSON results'))
      }
    })
  })
}

/**
 * Run package-build-stats on a package using the local build
 */
export async function runLocal(packageName: string): Promise<PackageStats> {
  return new Promise((resolve, reject) => {
    const runnerPath = path.join(config.scriptDir, 'runner.ts')

    const child = spawn('tsx', [runnerPath, packageName], {
      cwd: config.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', data => {
      stdout += data.toString()
    })

    child.stderr.on('data', data => {
      stderr += data.toString()
    })

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Local test failed: ${stderr}`))
        return
      }

      const match = stdout.match(/---RESULT_START---([\s\S]*?)---RESULT_END---/)
      if (!match) {
        reject(new Error('Failed to parse local results'))
        return
      }

      try {
        const result = JSON.parse(match[1].trim())
        resolve(result)
      } catch (error) {
        reject(new Error('Failed to parse JSON results'))
      }
    })
  })
}

/**
 * Run comparison for a single package
 */
export async function comparePackage(
  packageName: string,
): Promise<{ published: PackageStats; local: PackageStats }> {
  logger.info(`Testing: ${packageName}`)

  const [published, local] = await Promise.all([
    runPublished(packageName),
    runLocal(packageName),
  ])

  logger.success(`Completed: ${packageName}`)

  return { published, local }
}

/**
 * Run comparison with minification toggle
 */
export async function comparePackageWithMinification(
  packageName: string,
  minified: boolean,
): Promise<{ published: PackageStats; local: PackageStats }> {
  logger.info(`Testing: ${packageName} (minified: ${minified})`)

  // For now, return regular comparison
  // This can be extended to support minification options
  return comparePackage(packageName)
}

/**
 * Run comparisons in parallel with concurrency limit
 */
export async function comparePackagesParallel(
  packages: string[],
  concurrency: number = config.concurrency,
): Promise<
  Array<{
    package: string
    published: PackageStats
    local: PackageStats
    error?: string
  }>
> {
  const results: Array<{
    package: string
    published: PackageStats
    local: PackageStats
    error?: string
  }> = []
  const queue = [...packages]
  let running = 0
  let completed = 0

  return new Promise(resolve => {
    const processNext = () => {
      if (queue.length === 0 && running === 0) {
        resolve(results)
        return
      }

      while (running < concurrency && queue.length > 0) {
        const pkg = queue.shift()!
        running++

        comparePackage(pkg)
          .then(({ published, local }) => {
            results.push({ package: pkg, published, local })
          })
          .catch(error => {
            logger.error(`Failed: ${pkg} - ${error.message}`)
            results.push({
              package: pkg,
              published: {} as any,
              local: {} as any,
              error: error.message,
            })
          })
          .finally(() => {
            running--
            completed++
            logger.info(`Progress: ${completed}/${packages.length} packages`)
            processNext()
          })
      }
    }

    processNext()
  })
}
