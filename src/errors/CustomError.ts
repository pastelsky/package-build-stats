/**
 * Wraps the original error with a identifiable
 * name.
 */
class CustomError extends Error {
  readonly originalError: unknown
  readonly extra: unknown

  constructor(name: string, originalError: unknown, extra?: unknown) {
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

export class EntryPointError extends CustomError {
  constructor(originalError: unknown, extra?: unknown) {
    super('EntryPointError', originalError, extra)
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

export class MissingDependencyError extends CustomError {
  missingModules: Array<string>
  constructor(
    originalError: unknown,
    extra: { missingModules: Array<string> },
  ) {
    super('MissingDependencyError', originalError, extra)
    this.missingModules = extra.missingModules
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
