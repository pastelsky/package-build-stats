/**
 * CLI argument parsing and help text
 */

import { logger } from './logger'

export interface ParsedArgs {
  command: string
  args: string[]
  options: Record<string, string | boolean>
}

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [, , command, ...rest] = argv
  const args: string[] = []
  const options: Record<string, string | boolean> = {}

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')
      options[key] = value || true
    } else if (arg.startsWith('-')) {
      const key = arg.substring(1)
      options[key] = true
    } else {
      args.push(arg)
    }
  }

  return {
    command: command || 'help',
    args,
    options,
  }
}

/**
 * Show help text
 */
export function showHelp(): void {
  logger.box('Package Build Stats - Comparison Tool', 'blue')
  logger.blank()

  logger.info('USAGE:')
  console.log('  package-stats <command> [options] [packages...]')
  logger.blank()

  logger.info('COMMANDS:')
  console.log('  list [N]           List available packages (default: 50)')
  console.log('  test <pkg...>      Test specific packages')
  console.log('  top [N]            Test top N packages (default: 20)')
  console.log('  compare <pkg...>   Compare published vs local (advanced)')
  console.log('  help               Show this help text')
  logger.blank()

  logger.info('EXAMPLES:')
  console.log('  package-stats list                    # List top 50 packages')
  console.log('  package-stats list --all              # List all packages')
  console.log(
    '  package-stats test lodash react       # Test specific packages',
  )
  console.log('  package-stats top 10                  # Test top 10 packages')
  console.log('  package-stats compare lodash --minification')
  logger.blank()

  logger.info('OPTIONS:')
  console.log('  --all              Show all results (list command)')
  console.log('  --concurrency N    Number of parallel tests (default: 5)')
  console.log(
    '  --timeout MS       Test timeout in milliseconds (default: 120000)',
  )
  console.log('  --minification     Compare with minification enabled')
  console.log('  --exports          Include export size analysis')
  console.log('  --json             Output results as JSON')
  console.log('  --help             Show this help text')
  logger.blank()

  logger.info('PERFORMANCE:')
  console.log('  Tests run in parallel for faster results')
  console.log('  Default concurrency: 5 packages at a time')
  console.log('  Typical time per package: ~60 seconds')
  logger.blank()

  logger.info('OUTPUT:')
  console.log('  Results saved to: comparison-results/YYYYMMDD_HHMMSS/')
  logger.blank()
}

/**
 * Show command help
 */
export function showCommandHelp(command: string): void {
  switch (command) {
    case 'list':
      logger.info('LIST - Show available packages')
      console.log('')
      console.log('  Usage: package-stats list [N]')
      console.log('  Options: --all (show all packages)')
      console.log('')
      console.log('  Examples:')
      console.log('    package-stats list          # Show first 50 packages')
      console.log('    package-stats list --all    # Show all packages')
      break

    case 'test':
      logger.info('TEST - Test specific packages')
      console.log('')
      console.log('  Usage: package-stats test <package> [package2...]')
      console.log('  Options: --concurrency N (default: 5)')
      console.log('')
      console.log('  Examples:')
      console.log('    package-stats test lodash react')
      console.log('    package-stats test lodash@4.17.21')
      console.log('    package-stats test react --concurrency 2')
      break

    case 'top':
      logger.info('TOP - Test top N packages')
      console.log('')
      console.log('  Usage: package-stats top [N]')
      console.log('  Default N: 20')
      console.log('')
      console.log('  Examples:')
      console.log('    package-stats top         # Test top 20')
      console.log('    package-stats top 50      # Test top 50')
      break

    case 'compare':
      logger.info('COMPARE - Compare published vs local version')
      console.log('')
      console.log('  Usage: package-stats compare <package> [package2...]')
      console.log('')
      console.log('  Examples:')
      console.log('    package-stats compare lodash')
      console.log('    package-stats compare react@18')
      break

    default:
      showHelp()
  }
}

/**
 * Validate command arguments
 */
export function validateCommand(
  command: string,
  args: string[],
): { valid: boolean; error?: string } {
  switch (command) {
    case 'test':
      if (args.length === 0) {
        return {
          valid: false,
          error: 'test command requires at least one package name',
        }
      }
      break

    case 'compare':
      if (args.length === 0) {
        return {
          valid: false,
          error: 'compare command requires at least one package name',
        }
      }
      break

    case 'top':
      if (args.length > 1) {
        return {
          valid: false,
          error: 'top command takes at most one argument (number of packages)',
        }
      }
      if (args.length === 1 && isNaN(parseInt(args[0], 10))) {
        return { valid: false, error: 'top command argument must be a number' }
      }
      break

    case 'list':
      if (args.length > 1) {
        return {
          valid: false,
          error: 'list command takes at most one argument',
        }
      }
      break

    case 'help':
      break

    default:
      return { valid: false, error: `Unknown command: ${command}` }
  }

  return { valid: true }
}
