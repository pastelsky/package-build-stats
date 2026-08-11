/**
 * Wraps the original error with a identifiable
 * name.
 */
class CustomError<TExtra = unknown> extends Error {
  readonly originalError: unknown
  readonly extra: TExtra

  constructor(name: string, originalError: unknown, extra: TExtra) {
    super(name, { cause: originalError })
    this.name = name
    this.originalError = originalError
    this.extra = extra
  }

  toJSON() {
    return {
      name: this.name,
      originalError: this.originalError,
      extra: this.extra,
    }
  }
}

export class BuildError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('BuildError', originalError, extra)
  }
}

export class BuildCancelledError extends CustomError {
  readonly code = 'BUILD_CANCELLED'

  constructor() {
    super('BuildCancelledError', 'Package build was cancelled', undefined)
  }
}

export class EntryPointError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('EntryPointError', originalError, extra)
  }
}

export class InvalidPackageEntryPointError extends CustomError<{
  entryPoint: string
}> {
  constructor(entryPoint: string) {
    super(
      'InvalidPackageEntryPointError',
      `Package entry point ${JSON.stringify(entryPoint)} is not importable`,
      { entryPoint },
    )
  }
}

export class InstallError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('InstallError', originalError, extra)
  }
}

export class PackageNotFoundError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('PackageNotFoundError', originalError, extra)
  }
}

export class CLIBuildError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('CLIBuildError', originalError, extra)
  }
}

export class MinifyError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('MinifyError', originalError, extra)
  }
}

export class MissingDependencyError extends CustomError<{
  missingModules: Array<string>
}> {
  get missingModules() {
    return this.extra.missingModules
  }

  constructor(
    originalError: unknown,
    extra: { missingModules: Array<string> },
  ) {
    super('MissingDependencyError', originalError, extra)
  }
}

export class UnexpectedBuildError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('UnexpectedBuildError', originalError, extra)
  }
}

export class UnsupportedPackageError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('UnsupportedPackageError', originalError, extra)
  }
}
