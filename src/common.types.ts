export const packageManagers = ['npm', 'yarn', 'pnpm', 'bun'] as const
export type PackageManager = (typeof packageManagers)[number]

type AllOptions = {
  customImports?: Array<string>
  importPoint?: string
  splitCustomImports?: boolean
  debug?: boolean
  minify?: boolean
  esm?: boolean
  entryFilename?: string
  client?: PackageManager | PackageManager[]
  limitConcurrency?: boolean
  networkConcurrency?: number
  additionalPackages?: Array<string>
  isLocal?: boolean
  installTimeout?: number
  signal?: AbortSignal
}

export type BuildPackageOptions = Pick<
  AllOptions,
  | 'customImports'
  | 'importPoint'
  | 'splitCustomImports'
  | 'debug'
  | 'minify'
  | 'signal'
> & {
  includeDependencySizes: boolean
}

export type CreateEntryPointOptions = Pick<
  AllOptions,
  'esm' | 'customImports' | 'importPoint' | 'entryFilename'
>
export type InstallPackageOptions = Pick<
  AllOptions,
  | 'client'
  | 'limitConcurrency'
  | 'networkConcurrency'
  | 'additionalPackages'
  | 'isLocal'
  | 'installTimeout'
  | 'debug'
  | 'signal'
>

export type GetPackageStatsOptions = Pick<
  AllOptions,
  | 'client'
  | 'limitConcurrency'
  | 'networkConcurrency'
  | 'debug'
  | 'customImports'
  | 'importPoint'
  | 'installTimeout'
  | 'minify'
  | 'signal'
>

export type Externals = {
  externalPackages: Array<string>
  externalBuiltIns: Array<string>
}
