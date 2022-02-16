import { Entry } from 'webpack';
import { DiagnosticLogEvent } from '@parcel/types';
import { Externals, BuildPackageOptions, CreateEntryPointOptions } from '../common.types';
declare type CompilePackageArgs = {
    name: string;
    externals: Externals;
    entry: Entry;
    debug?: boolean;
    minifier: 'terser' | 'esbuild';
};
declare type BuildPackageArgs = {
    name: string;
    installPath: string;
    externals: Externals;
    options: BuildPackageOptions;
};
declare const BuildUtils: {
    createEntryPoint(packageName: string, installPath: string, options: CreateEntryPointOptions): string;
    compilePackage({ name, entry, externals, installPath, debug, minifier, }: CompilePackageArgs): Promise<{
        assets: {
            file: string;
            size: number;
        }[];
    }>;
    _parseMissingModules(errors: DiagnosticLogEvent['diagnostics']): string[];
    buildPackage({ name, installPath, externals, options, }: BuildPackageArgs): Promise<{
        assets: ({
            name: string;
            type: string;
            size: number;
            gzip: number;
            parse: {
                baseParseTime: number;
                scriptParseTime: number;
            } | {
                baseParseTime?: undefined;
                scriptParseTime?: undefined;
            } | null;
        } | null)[];
    } | undefined>;
    buildPackageIgnoringMissingDeps({ name, externals, installPath, options, }: BuildPackageArgs): Promise<{
        assets: ({
            name: string;
            type: string;
            size: number;
            gzip: number;
            parse: {
                baseParseTime: number;
                scriptParseTime: number;
            } | {
                baseParseTime?: undefined;
                scriptParseTime?: undefined;
            } | null;
        } | null)[];
    } | {
        assets?: ({
            name: string;
            type: string;
            size: number;
            gzip: number;
            parse: {
                baseParseTime: number;
                scriptParseTime: number;
            } | {
                baseParseTime?: undefined;
                scriptParseTime?: undefined;
            } | null;
        } | null)[] | undefined;
        ignoredMissingDependencies: any;
    } | undefined>;
};
export default BuildUtils;
