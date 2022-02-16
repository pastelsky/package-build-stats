declare const emitter: import("mitt").Emitter;
export { emitter };
export default class Telemetry {
    static installPackage(packageString: string, isSuccessful: boolean, startTime: number, options: any, error?: any): void;
    static getPackageJSONDetails(packageName: string, isSuccessful: boolean, startTime: number, error?: any): void;
    static buildPackage(packageName: string, isSuccessful: boolean, startTime: number, options: any, error?: any): void;
    static compilePackage(packageName: string, isSuccessful: boolean, startTime: number, options: any, error?: any): void;
    static packageStats(packageString: string, isSuccessful: boolean, startTime: number, options: any, error?: any): void;
    static parseWebpackStats(packageName: string, isSuccessful: boolean, startTime: number, error?: any): void;
    static dependencySizes(packageName: string, startTime: number, isSuccessful: boolean, options: any, error?: any): void;
    static assetsGZIPParseTime(packageName: string, startTime: number): void;
    static walkPackageExportsTree(packageString: string, startTime: number, isSuccessful: boolean, error?: any): void;
    static packageExports(packageString: string, startTime: number, isSuccessful: boolean, error?: any): void;
    static packageExportsSizes(packageString: string, startTime: number, isSuccessful: boolean, options: any, error?: any): void;
}
