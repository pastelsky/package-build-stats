export type Minifier = 'esbuild' | 'terser'

export type AllOptions = {
  customImports?: Array<string>
  splitCustomImports?: boolean
  debug?: boolean
  calcParse?: boolean
  esm?: boolean
  entryFilename?: string
  client?: 'npm' | 'yarn' | 'pnpm'
  limitConcurrency?: boolean
  networkConcurrency?: number
  additionalPackages?: Array<string>
  isLocal?: boolean
  installTimeout?: number
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
  | 'installTimeout'
>

export type GetPackageStatsOptions = Pick<
  AllOptions,
  | 'client'
  | 'limitConcurrency'
  | 'networkConcurrency'
  | 'debug'
  | 'customImports'
  | 'installTimeout'
> & {
  minifier?: Minifier
}

export type Externals = {
  externalPackages: Array<string>
  externalBuiltIns: Array<string>
}
