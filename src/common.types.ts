export const packageManagers = ['npm', 'yarn', 'pnpm', 'bun'] as const
export type PackageManager = (typeof packageManagers)[number]

/** Host-supplied removal of one SDK-owned workspace, not shared-cache eviction. */
export type CleanupFunction = (directory: string) => Promise<void>
export type PackageManagerCommand = (
  client: PackageManager,
  args: readonly string[],
) => { command: string; args: string[] }

export type PackageInstallation = {
  packageString: string
  packageName: string
  installPath: string
  packagePath: string
  /** The package manager that succeeded, after any fallbacks. */
  client?: PackageManager
}

export type InstallationLease = PackageInstallation & {
  release(): Promise<void>
}

export type InstallationProvider = (
  packageString: string,
  options: InstallPackageOptions,
) => Promise<InstallationLease>

type AllOptions = {
  /** Public package subpath, e.g. './mini'; '.' (the root) is the default. */
  entryPoint?: string
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
  signal?: AbortSignal
  installationProvider?: InstallationProvider
  /** Removes SDK-owned workspaces; defaults to portable recursive deletion. */
  cleanup?: CleanupFunction
  /** Keep Bun's text lockfile for host-side dependency accounting. */
  saveLockfile?: boolean
  /** Optional host wrapper for package-manager execution, e.g. an OS lock. */
  packageManagerCommand?: PackageManagerCommand
}

export type BuildPackageOptions = Pick<
  AllOptions,
  | 'entryPoint'
  | 'customImports'
  | 'splitCustomImports'
  | 'debug'
  | 'minify'
  | 'signal'
> & {
  includeDependencySizes: boolean
}

export type CreateEntryPointOptions = Pick<
  AllOptions,
  'esm' | 'entryPoint' | 'customImports' | 'entryFilename'
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
  | 'installationProvider'
  | 'cleanup'
  | 'saveLockfile'
  | 'packageManagerCommand'
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
  | 'signal'
  | 'installationProvider'
  | 'cleanup'
  | 'saveLockfile'
  | 'packageManagerCommand'
  | 'entryPoint'
>

export type GetPackageExportsOptions = InstallPackageOptions &
  Pick<AllOptions, 'entryPoint'>

export type Externals = {
  externalPackages: Array<string>
  externalBuiltIns: Array<string>
}
