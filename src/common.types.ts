type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

type AllOptions = {
  customImports?: Array<string>
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
}

export type BuildPackageOptions = Pick<
  AllOptions,
  'customImports' | 'splitCustomImports' | 'debug' | 'minify'
> & {
  includeDependencySizes: boolean
}

export type CreateEntryPointOptions = Pick<
  AllOptions,
  'esm' | 'customImports' | 'entryFilename'
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
>

export type GetPackageStatsOptions = Pick<
  AllOptions,
  | 'client'
  | 'limitConcurrency'
  | 'networkConcurrency'
  | 'debug'
  | 'customImports'
  | 'installTimeout'
  | 'minify'
>

export type Externals = {
  externalPackages: Array<string>
  externalBuiltIns: Array<string>
}
