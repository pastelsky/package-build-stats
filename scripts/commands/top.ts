/**
 * TOP command - Test top N packages
 */

import { logger } from '../utils/logger'
import { getTopPackages } from '../utils/package-loader'
import { testCommand } from './test'

export async function topCommand(
  args: string[],
  options: Record<string, any>,
): Promise<void> {
  const count = args.length > 0 ? parseInt(args[0], 10) : 20

  if (isNaN(count) || count <= 0) {
    logger.error(`Invalid count: ${args[0]}`)
    process.exit(1)
  }

  logger.info(`Testing top ${count} packages...`)
  logger.blank()

  const packages = getTopPackages(count)

  if (packages.length === 0) {
    logger.error('No packages found in list')
    process.exit(1)
  }

  if (packages.length < count) {
    logger.warning(
      `Only ${packages.length} packages available (requested ${count})`,
    )
  }

  // Use test command with the top packages
  await testCommand(packages, options)
}
