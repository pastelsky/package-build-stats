/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */
import { GetPackageStatsOptions } from './common.types';
export default function getPackageStats(packageString: string, optionsRaw: GetPackageStatsOptions): Promise<{
    buildVersion: any;
    size: number;
    gzip: number;
    parse: {
        baseParseTime?: number | undefined;
        scriptParseTime?: number | undefined;
    } | null;
    assets: {
        name: string;
        type: string;
        size: number;
        gzip: number;
        parse: {
            baseParseTime?: number | undefined;
            scriptParseTime?: number | undefined;
        } | null;
    }[];
    dependencyCount: number;
    mainFields: any[];
    hasJSNext: any;
    hasJSModule: any;
    isModuleType: boolean;
    hasSideEffects: any;
    peerDependencies: string[];
} | {
    buildVersion: any;
    size: number;
    gzip: number;
    parse: {
        baseParseTime?: number | undefined;
        scriptParseTime?: number | undefined;
    } | null;
    assets: {
        name: string;
        type: string;
        size: number;
        gzip: number;
        parse: {
            baseParseTime?: number | undefined;
            scriptParseTime?: number | undefined;
        } | null;
    }[];
    ignoredMissingDependencies: any;
    dependencyCount: number;
    mainFields: any[];
    hasJSNext: any;
    hasJSModule: any;
    isModuleType: boolean;
    hasSideEffects: any;
    peerDependencies: string[];
}>;
