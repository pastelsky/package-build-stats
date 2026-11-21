declare module 'npm-install-checks' {
  export interface PlatformTarget {
    _id?: string
    os?: readonly string[]
    cpu?: readonly string[]
    libc?: readonly string[]
  }

  export interface PlatformEnvironment {
    os?: string
    cpu?: string
    libc?: string | null
  }

  export function checkPlatform(
    target: PlatformTarget,
    force?: boolean,
    environment?: PlatformEnvironment,
  ): void
}
