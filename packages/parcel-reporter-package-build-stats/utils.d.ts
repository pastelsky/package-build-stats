import memoize from 'memoizee';
import { FileSystem } from '@parcel/fs';
export declare const getPackageRoot: (filePath: string, specifier: string) => {
    packageRoot: string;
    packageName: string;
};
export declare const readJSONFile: (filePath: string) => Promise<any>;
export declare const readJSONFileFromFS: (fs: FileSystem, filePath: string) => Promise<any>;
export declare const isPackageSpecifier: (specifier: string) => boolean;
export declare const isSpecifierNotIgnored: (specifier: string, peerDependencies: {
    [key: string]: string;
}) => boolean;
export declare const getDependencyFromSpecifier: (specifier: string) => string;
export declare const getPackageJSONDetails: ((packageRoot: any) => Promise<any>) & memoize.Memoized<(packageRoot: any) => Promise<any>>;
export declare function notEmpty<TValue>(value: TValue | null | undefined): value is TValue;
