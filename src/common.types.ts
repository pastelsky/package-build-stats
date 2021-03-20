type Minifier = 'esbuild' | 'terser'

type AllOptions = {
  customImports?: Array<string>
  splitCustomImports?: boolean
  debug?: boolean
  calcParse?: boolean
  esm?: boolean
  entryFilename?: string
  client?: 'npm' | 'yarn'
  limitConcurrency?: boolean
  networkConcurrency?: number
  additionalPackages?: Array<string>
  isLocal?: boolean
}

export type BuildPackageOptions = Pick<
  AllOptions,
  'customImports' | 'splitCustomImports' | 'debug' | 'calcParse'
> & {
  includeDependencySizes: boolean
  minifier: Minifier
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
>

export type GetPackageStatsOptions = Pick<
  AllOptions,
  | 'client'
  | 'limitConcurrency'
  | 'networkConcurrency'
  | 'debug'
  | 'customImports'
> & {
  minifier?: Minifier
}

export type Externals = {
  externalPackages: Array<string>
  externalBuiltIns: Array<string>
}

// This isn't exposed by webpack
// but is used in their public interfaces
export type WebpackError = {
  name: 'ModuleNotFoundError'
  details?: string
  error: Error
}
