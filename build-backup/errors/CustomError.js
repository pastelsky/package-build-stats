"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnexpectedBuildError = exports.MissingDependencyError = exports.MinifyError = exports.CLIBuildError = exports.PackageNotFoundError = exports.InstallError = exports.EntryPointError = exports.BuildError = void 0;
/**
 * Wraps the original error with a identifiable
 * name.
 */
class CustomError extends Error {
    constructor(name, originalError, extra) {
        super(name);
        this.name = name;
        this.originalError = originalError;
        this.extra = extra;
        Object.setPrototypeOf(this, CustomError.prototype);
    }
    toJSON() {
        return {
            name: this.name,
            originalError: this.originalError,
            extra: this.extra,
        };
    }
}
class BuildError extends CustomError {
    constructor(originalError, extra) {
        super('BuildError', originalError, extra);
        Object.setPrototypeOf(this, BuildError.prototype);
    }
}
exports.BuildError = BuildError;
class EntryPointError extends CustomError {
    constructor(originalError, extra) {
        super('EntryPointError', originalError, extra);
        Object.setPrototypeOf(this, EntryPointError.prototype);
    }
}
exports.EntryPointError = EntryPointError;
class InstallError extends CustomError {
    constructor(originalError, extra) {
        super('InstallError', originalError, extra);
        Object.setPrototypeOf(this, InstallError.prototype);
    }
}
exports.InstallError = InstallError;
class PackageNotFoundError extends CustomError {
    constructor(originalError, extra) {
        super('PackageNotFoundError', originalError, extra);
        Object.setPrototypeOf(this, PackageNotFoundError.prototype);
    }
}
exports.PackageNotFoundError = PackageNotFoundError;
class CLIBuildError extends CustomError {
    constructor(originalError, extra) {
        super('CLIBuildError', originalError, extra);
        Object.setPrototypeOf(this, CLIBuildError.prototype);
    }
}
exports.CLIBuildError = CLIBuildError;
class MinifyError extends CustomError {
    constructor(originalError, extra) {
        super('MinifyError', originalError, extra);
        Object.setPrototypeOf(this, MinifyError.prototype);
    }
}
exports.MinifyError = MinifyError;
class MissingDependencyError extends CustomError {
    constructor(originalError, extra) {
        super('MissingDependencyError', originalError, extra);
        this.missingModules = extra.missingModules;
        Object.setPrototypeOf(this, MissingDependencyError.prototype);
    }
}
exports.MissingDependencyError = MissingDependencyError;
class UnexpectedBuildError extends CustomError {
    constructor(originalError, extra) {
        super('UnexpectedBuildError', originalError, extra);
        Object.setPrototypeOf(this, UnexpectedBuildError.prototype);
    }
}
exports.UnexpectedBuildError = UnexpectedBuildError;
