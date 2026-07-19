#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { packageManagers } from '../build/common.types.js'
import { getPackageStats } from '../build/index.js'

await yargs(hideBin(process.argv))
  .scriptName('package-stats')
  .usage('$0 <command> [options]')
  .command(
    'stats <pkg>',
    'Fetch the bundle size of an npm package',
    command =>
      command
        .positional('pkg', {
          describe: 'Package name, version, or local path',
          type: 'string',
          demandOption: true,
        })
        .option('client', {
          alias: 'c',
          type: 'string',
          description: 'Package manager used to install the package',
          choices: packageManagers,
        })
        .option('debug', {
          alias: 'd',
          type: 'boolean',
          description: 'Keep temporary build files for debugging',
          default: false,
        }),
    async ({ client, debug, pkg }) => {
      try {
        const result = await getPackageStats(pkg, { client, debug })
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      } catch (error) {
        console.error('Error fetching package stats:', error)
        process.exitCode = 1
      }
    },
  )
  .demandCommand(1)
  .strict()
  .help()
  .parseAsync()
