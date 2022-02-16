/**
 * Parses code to return all named (and default exports)
 * as well as `export * from` locations
 */
export declare function getExportsDetails(code: string): {
    exportAllLocations: string[];
    exports: string[];
};
declare type ResolvedExports = {
    [key: string]: string;
};
/**
 * Recursively get all exports starting
 * from a given path
 */
export declare function getAllExports(packageString: string, context: string, lookupPath: string): Promise<ResolvedExports>;
export {};
