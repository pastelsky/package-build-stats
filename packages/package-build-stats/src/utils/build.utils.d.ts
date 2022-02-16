import { Externals, BuildPackageOptions, CreateEntryPointOptions } from '../common.types';
import { Diagnostic } from '@parcel/diagnostic';
declare type CompilePackageArgs = {
    name: string;
    externals: Externals;
    entry: EntryObject;
    debug?: boolean;
    minifier: 'terser' | 'esbuild';
    installPath: string;
};
declare type BuildPackageArgs = {
    name: string;
    installPath: string;
    externals: Externals;
    options: BuildPackageOptions;
};
declare type EntryObject = {
    [key: string]: string;
};
declare type CompiledAssetStat = {
    file: string;
    size: number;
};
declare type CompilePackageReturn = {
    assets: CompiledAssetStat[];
};
declare type BuiltAssetStat = {
    name: string;
    type: string;
    size: number;
    gzip: number;
    parse: {
        baseParseTime?: number;
        scriptParseTime?: number;
    } | null;
};
declare type BuildPackageReturn = {
    assets: BuiltAssetStat[];
};
declare const BuildUtils: {
    createEntryPoint(packageName: string, installPath: string, options: CreateEntryPointOptions): string;
    compilePackage({ name, entry, externals, debug, minifier, installPath, }: CompilePackageArgs): Promise<CompilePackageReturn>;
    _parseMissingModules(errors: Array<Diagnostic>): string[];
    buildPackage({ name, installPath, externals, options, }: BuildPackageArgs): Promise<BuildPackageReturn>;
    buildPackageIgnoringMissingDeps({ name, externals, installPath, options, }: BuildPackageArgs): Promise<BuildPackageReturn | {
        assets: BuiltAssetStat[];
        ignoredMissingDependencies: any;
    }>;
};
export default BuildUtils;
