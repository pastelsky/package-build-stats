/**
 * Utility to load and manage package lists
 */

import fs from 'fs'
import { config } from './config'
import { logger } from './logger'

export interface PackageInfo {
  name: string
  version?: string
  rank?: number
}

/**
 * Load packages from the static list file
 */
export function loadPackageList(): string[] {
  const { packageListFile } = config

  if (!fs.existsSync(packageListFile)) {
    logger.error(`Package list not found at ${packageListFile}`)
    throw new Error('Package list file not found')
  }

  return fs
    .readFileSync(packageListFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

/**
 * Parse package string into name and version
 */
export function parsePackageString(packageString: string): PackageInfo {
  const match = packageString.match(/^(@?[^@]+)(?:@(.+))?$/)
  if (!match) {
    throw new Error(`Invalid package string: ${packageString}`)
  }

  return {
    name: match[1],
    version: match[2],
  }
}

/**
 * Get top N packages from the list
 */
export function getTopPackages(count: number): string[] {
  const packages = loadPackageList()
  return packages.slice(0, count)
}

/**
 * Format package list for display
 */
export function formatPackageList(packages: string[], showCount = 50): void {
  logger.divider('green')
  logger.info(`Top ${packages.length} Packages`)
  logger.divider('green')
  logger.blank()

  packages.slice(0, showCount).forEach((pkg, i) => {
    console.log(`${(i + 1).toString().padStart(4)}. ${pkg}`)
  })

  if (packages.length > showCount) {
    logger.blank()
    logger.info(
      `... (showing first ${showCount} of ${packages.length} packages)`,
    )
  }

  logger.blank()
}
