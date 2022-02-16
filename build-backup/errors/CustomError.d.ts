/**
 * Wraps the original error with a identifiable
 * name.
 */
declare class CustomError extends Error {
    originalError: any;
    extra: any;
    constructor(name: string, originalError: Error, extra?: any);
    toJSON(): {
        name: string;
        originalError: any;
        extra: any;
    };
}
export declare class BuildError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export declare class EntryPointError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export declare class InstallError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export declare class PackageNotFoundError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export declare class CLIBuildError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export declare class MinifyError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export declare class MissingDependencyError extends CustomError {
    missingModules: Array<string>;
    constructor(originalError: any, extra: {
        missingModules: Array<string>;
    });
}
export declare class UnexpectedBuildError extends CustomError {
    constructor(originalError: any, extra?: any);
}
export {};
