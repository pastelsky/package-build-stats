import { Command, Flags } from '@oclif/core'
import { getAllPackageExports } from 'package-build-stats'
import Purdy from 'purdy'

export default class Total extends Command {
  static description = 'Total bundled size of an NPM package'

  static examples = [`$ npmsize exports package-name`]

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
    local: Flags.boolean({
      char: 'l',
      description: 'Get exports of a local package',
      required: false,
    }),
    installTimeout: Flags.integer({
      char: 't',
      description: 'Install timeout in ms',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Total)
    const result = await getAllPackageExports(args.package, {
      // @ts-ignore - convert string to enum
      client: flags.client,
      limitConcurrency: flags.limitConcurrency,
      networkConcurrency: flags.networkConcurrency,
      isLocal: flags.local,
      installTimeout: flags.installTimeout,
    })

    Purdy(result, {})
  }
}
