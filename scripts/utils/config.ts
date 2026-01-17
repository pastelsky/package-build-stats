/**
 * Centralized configuration for comparison scripts
 */

import path from 'path'

export interface ScriptConfig {
  // Directories
  scriptDir: string
  projectRoot: string
  resultsDir: string
  cacheDir: string

  // Files
  packageListFile: string

  // Execution settings
  concurrency: number
  timeout: number
  useCache: boolean

  // Package manager
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
}

export function getConfig(): ScriptConfig {
  const scriptDir = __dirname.endsWith('/utils')
    ? path.join(__dirname, '..')
    : __dirname
  const projectRoot = path.join(scriptDir, '..')

  return {
    scriptDir,
    projectRoot,
    resultsDir: path.join(scriptDir, 'comparison-results'),
    cacheDir: path.join(scriptDir, '.master-cache'),
    packageListFile: path.join(scriptDir, 'top-packages-list.txt'),
    concurrency: parseInt(process.env.CONCURRENCY || '5', 10),
    timeout: parseInt(process.env.TIMEOUT || '120000', 10),
    useCache: process.env.USE_CACHE !== 'false',
    packageManager: (process.env.PKG_MANAGER as any) || 'yarn',
  }
}

export const config = getConfig()
