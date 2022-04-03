import { Command, Flags } from '@oclif/core'
import { getPackageExportSizes } from 'package-build-stats'
import Purdy from 'purdy'

export default class ExportSizes extends Command {
  static description = 'Get export sizes of a package'

  static examples = [`$ npmsize export-sizes package-name`]

  static args = [
    {
      name: 'package',
      description: 'Name / Version of the NPM package',
      required: true,
    },
  ]

  static flags = {
    client: Flags.string({
      char: 'p',
      description: 'Which npm package manager to use',
      required: false,
      options: ['npm', 'yarn', 'pnpm'],
    }),
    customImports: Flags.string({
      char: 'i',
      description: 'Comma separated custom imports',
      required: false,
    }),
    debug: Flags.boolean({
      char: 'd',
      description: 'Debug builds',
      required: false,
    }),
    limitConcurrency: Flags.boolean({
      char: 'c',
      description: 'Limit concurrency',
      required: false,
    }),
    networkConcurrency: Flags.integer({
      char: 'n',
      description: 'Network concurrency',
      required: false,
    }),
    installTimeout: Flags.integer({
      char: 't',
      description: 'Install timeout in ms',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ExportSizes)
    const result = await getPackageExportSizes(args.package, {
      // @ts-ignore - convert string to enum
      client: flags.client,
      limitConcurrency: flags.limitConcurrency,
      networkConcurrency: flags.networkConcurrency,
      debug: flags.debug,
      customImports: flags.customImports?.split(','),
      installTimeout: flags.installTimeout,
    })

    Purdy(result, {})
  }
}
