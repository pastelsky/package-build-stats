#!/usr/bin/env node

/**
 * Package Build Stats - Comparison Tool
 * Main entry point for all comparison commands
 */

import { parseArgs, showHelp, showCommandHelp, validateCommand } from './utils/cli'
import { logger } from './utils/logger'
import { listCommand } from './commands/list'
import { testCommand } from './commands/test'
import { topCommand } from './commands/top'

async function main() {
  const args = parseArgs(process.argv)

  // Handle help and unknown commands
  if (args.options.help || args.command === 'help') {
    if (args.args.length > 0) {
      showCommandHelp(args.args[0])
    } else {
      showHelp()
    }
    process.exit(0)
  }

  // Validate command
  const validation = validateCommand(args.command, args.args)
  if (!validation.valid) {
    logger.error(validation.error!)
    logger.blank()
    showCommandHelp(args.command)
    process.exit(1)
  }

  try {
    // Route to appropriate command
    switch (args.command) {
      case 'list':
        await listCommand(args.args, args.options)
        break

      case 'test':
        await testCommand(args.args, args.options)
        break

      case 'top':
        await topCommand(args.args, args.options)
        break

      default:
        logger.error(`Unknown command: ${args.command}`)
        showHelp()
        process.exit(1)
    }
  } catch (error) {
    logger.error(`Failed: ${(error as Error).message}`)
    process.exit(1)
  }
}

// Run main
main().catch(error => {
  logger.error(`Fatal error: ${error.message}`)
  process.exit(1)
})
