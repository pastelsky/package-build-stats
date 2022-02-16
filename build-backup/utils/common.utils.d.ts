export declare function exec(
  command: string,
  options: any,
  timeout?: number
): Promise<unknown>
/**
 * Gets external peerDeps that shouldn't be a
 * part of the build in a regex format -
 * /(^dep-a$|^dep-a\/|^dep-b$|^dep-b\/)\//
 */
export declare function getExternals(
  packageName: string,
  installPath: string
): {
  externalPackages: string[]
  externalBuiltIns: string[]
}
declare type ParsePackageResult = {
  name: string
  version: string | null
  scoped: boolean
  isLocal?: boolean
  normalPath?: string
}
export declare function parsePackageString(
  packageString: string
): ParsePackageResult
export declare const parsePackageNameFromPath: (path: string) => string
/**
 *
 */
export declare function getPackageFromWebpackPath(filePath: string): {
  name: string
  cleanPath: string
}
export declare const getPackageJSONFromPath: any
export declare function updateProjectPeerDependencies(
  projectPath: string,
  peerDependencies: {
    [key: string]: string
  }
): Promise<void>
/**
 * eg.
 * loader!/private/tmp/tmp-build/packages/build-gulp-ORQ/node_modules/.pnpm/is-data@0.1.4/node_modules/is-data/index.ts =>  is-data/index.ts
 */
export declare function cleanWebpackPath(
  filePath: string,
  installPath: string
): string
export declare function isReactNativePackage(packageName: string): boolean
export {}
