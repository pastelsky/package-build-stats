#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import getPackageStats from '../src/getPackageStats'
import { GetPackageStatsOptions } from '../src/common.types' // Adjust the import path to where your TypeScript library entry point is

enum PackageManager {
  Npm = 'npm',
  Yarn = 'yarn',
}

yargs(hideBin(process.argv))
  .scriptName('package-stats')
  .usage('$0 <cmd> [args]')
  .command(
    'stats <pkg>',
    'Fetches the sizes of an npm package',
    yargs => {
      return yargs
        .positional('pkg', {
          describe: 'The name of the npm package',
          type: 'string',
          required: true,
        })
        .option('client', {
          alias: 'c',
          type: 'string',
          description: 'Specify the package manager client (npm or yarn)',
          choices: [PackageManager.Npm, PackageManager.Yarn],
        })
        .option('debug', {
          alias: 'd',
          type: 'boolean',
          description: 'Run in debug mode?',
          default: false,
        })
        .option('bundler', {
          alias: 'b',
          type: 'string',
          description: 'Specify the bundler',
          choices: ['webpack', 'rspack'],
        })
    },
    async argv => {
      const { client, pkg, bundler, debug } = argv

      if (!pkg) {
        throw new Error('Package must be defined')
      }

      // The interface of GetPackageStatsOptions might require defining or importing
      const options: Partial<GetPackageStatsOptions> = {
        client: client as PackageManager,
        bundler: bundler === 'webpack' ? 'webpack4' : 'rspack',
        debug: debug,
        // Include other options as necessary
      }

      try {
        const results = await getPackageStats(pkg, options)
        console.log(results)
      } catch (error) {
        console.error('Error fetching package stats:', error)
        process.exit(1)
      }
    },
  )
  .help()
  .parse()
