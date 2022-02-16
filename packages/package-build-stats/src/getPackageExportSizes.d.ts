import { GetPackageStatsOptions, InstallPackageOptions } from './common.types';
export declare function getAllPackageExports(packageString: string, options?: InstallPackageOptions): Promise<{
    [key: string]: string;
}>;
export declare function getPackageExportSizes(packageString: string, options?: GetPackageStatsOptions): Promise<{
    buildVersion: any;
    assets: {
        path: string;
        name: string;
        type: string;
        size: number;
        gzip: number;
        parse: {
            baseParseTime?: number | undefined;
            scriptParseTime?: number | undefined;
        } | null;
    }[];
} | {
    buildVersion: any;
    assets: {
        path: string;
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
}>;
