/**
 * Wraps the original error with a identifiable
 * name.
 */
class CustomError extends Error {
  originalError: any
  extra: any

  constructor(name: string, originalError: Error, extra?: any) {
    super(name)
    this.name = name
    this.originalError = originalError
    this.extra = extra
    Object.setPrototypeOf(this, CustomError.prototype)
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
  constructor(originalError: any, extra?: any) {
    super('BuildError', originalError, extra)
    Object.setPrototypeOf(this, BuildError.prototype)
  }
}

export class EntryPointError extends CustomError {
  constructor(originalError: any, extra?: any) {
    super('EntryPointError', originalError, extra)
    Object.setPrototypeOf(this, EntryPointError.prototype)
  }
}

export class InstallError extends CustomError {
  constructor(originalError: any, extra?: any) {
    super('InstallError', originalError, extra)
    Object.setPrototypeOf(this, InstallError.prototype)
  }
}

export class PackageNotFoundError extends CustomError {
  constructor(originalError: any, extra?: any) {
    super('PackageNotFoundError', originalError, extra)
    Object.setPrototypeOf(this, PackageNotFoundError.prototype)
  }
}

export class CLIBuildError extends CustomError {
  constructor(originalError: any, extra?: any) {
    super('CLIBuildError', originalError, extra)
    Object.setPrototypeOf(this, CLIBuildError.prototype)
  }
}

export class MinifyError extends CustomError {
  constructor(originalError: any, extra?: any) {
    super('MinifyError', originalError, extra)
    Object.setPrototypeOf(this, MinifyError.prototype)
  }
}

export class MissingDependencyError extends CustomError {
  missingModules: Array<string>
  constructor(originalError: any, extra: { missingModules: Array<string> }) {
    super('MissingDependencyError', originalError, extra)
    this.missingModules = extra.missingModules
    Object.setPrototypeOf(this, MissingDependencyError.prototype)
  }
}

export class UnexpectedBuildError extends CustomError {
  constructor(originalError: any, extra?: any) {
    super('UnexpectedBuildError', originalError, extra)
    Object.setPrototypeOf(this, UnexpectedBuildError.prototype)
  }
}
