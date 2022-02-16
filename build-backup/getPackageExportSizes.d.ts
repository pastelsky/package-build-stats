import { GetPackageStatsOptions, InstallPackageOptions } from './common.types';
export declare function getAllPackageExports(packageString: string, options?: InstallPackageOptions): Promise<{
    [key: string]: string;
}>;
export declare function getPackageExportSizes(packageString: string, options?: GetPackageStatsOptions): Promise<{
    buildVersion: any;
    assets: any;
}>;
