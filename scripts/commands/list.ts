/**
 * LIST command - Display available packages
 */

import { logger } from '../utils/logger'
import { loadPackageList, formatPackageList } from '../utils/package-loader'
import { config } from '../utils/config'

export async function listCommand(args: string[], options: Record<string, any>): Promise<void> {
  logger.box('Top NPM Packages', 'blue')
  logger.blank()

  const packages = loadPackageList()
  const showCount = options.all ? packages.length : 50

  formatPackageList(packages, showCount)

  logger.info(`Total packages in list: ${packages.length}`)
  logger.info(`Package list file: ${config.packageListFile}`)
  logger.blank()

  if (!options.all) {
    logger.info('TIP: Use --all to show all packages')
    logger.blank()
  }

  logger.info('To test packages:')
  console.log('  package-stats test lodash react    # Test specific packages')
  console.log('  package-stats top 10               # Test top 10 packages')
  logger.blank()
}
