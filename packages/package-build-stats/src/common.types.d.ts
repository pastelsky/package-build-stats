export declare type Minifier = 'esbuild' | 'terser';
export declare type AllOptions = {
    customImports?: Array<string>;
    splitCustomImports?: boolean;
    debug?: boolean;
    calcParse?: boolean;
    esm?: boolean;
    entryFilename?: string;
    client?: 'npm' | 'yarn';
    limitConcurrency?: boolean;
    networkConcurrency?: number;
    additionalPackages?: Array<string>;
    isLocal?: boolean;
    installTimeout?: number;
};
export declare type BuildPackageOptions = Pick<AllOptions, 'customImports' | 'splitCustomImports' | 'debug' | 'calcParse'> & {
    includeDependencySizes: boolean;
    minifier: Minifier;
};
export declare type CreateEntryPointOptions = Pick<AllOptions, 'esm' | 'customImports' | 'entryFilename'>;
export declare type InstallPackageOptions = Pick<AllOptions, 'client' | 'limitConcurrency' | 'networkConcurrency' | 'additionalPackages' | 'isLocal' | 'installTimeout'>;
export declare type GetPackageStatsOptions = Pick<AllOptions, 'client' | 'limitConcurrency' | 'networkConcurrency' | 'debug' | 'customImports' | 'installTimeout'> & {
    minifier?: Minifier;
};
export declare type Externals = {
    externalPackages: Array<string>;
    externalBuiltIns: Array<string>;
};
