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
        baseParseTime: number;
        scriptParseTime: number;
    } | {
        baseParseTime?: undefined;
        scriptParseTime?: undefined;
    } | null;
    dependencyCount?: number | undefined;
    mainFields?: any[] | undefined;
    hasJSNext?: any;
    hasJSModule?: any;
    isModuleType?: boolean | undefined;
    hasSideEffects?: any;
    peerDependencies?: string[] | undefined;
} | {
    buildVersion: any;
    size: number;
    gzip: number;
    parse: {
        baseParseTime: number;
        scriptParseTime: number;
    } | {
        baseParseTime?: undefined;
        scriptParseTime?: undefined;
    } | null;
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
    dependencyCount?: number | undefined;
    mainFields?: any[] | undefined;
    hasJSNext?: any;
    hasJSModule?: any;
    isModuleType?: boolean | undefined;
    hasSideEffects?: any;
    peerDependencies?: string[] | undefined;
} | {
    buildVersion: any;
    size: number;
    gzip: number;
    parse: {
        baseParseTime: number;
        scriptParseTime: number;
    } | {
        baseParseTime?: undefined;
        scriptParseTime?: undefined;
    } | null;
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
    dependencyCount?: number | undefined;
    mainFields?: any[] | undefined;
    hasJSNext?: any;
    hasJSModule?: any;
    isModuleType?: boolean | undefined;
    hasSideEffects?: any;
    peerDependencies?: string[] | undefined;
}>;
