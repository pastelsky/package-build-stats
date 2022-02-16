declare module '@parcel/node-resolver-core' {
    import type { FileSystem } from '@parcel/fs';
    import type { FilePath, PluginLogger, SpecifierType, Environment, SourceLocation, ResolveResult } from '@parcel/types';
    import type { PackageManager } from '@parcel/package-manager';
    type Options = {
        fs: FileSystem;
        projectRoot: FilePath;
        extensions: Array<string>;
        mainFields: Array<string>;
        packageManager?: PackageManager;
        logger?: PluginLogger;
    };
    type ResolveOptions = {
        filename: FilePath;
        parent: FilePath | null | undefined;
        specifierType: SpecifierType;
        env: Environment;
        sourcePath?: FilePath | null | undefined;
        loc?: SourceLocation | null | undefined;
    };
    export default class NodeResolver {
        constructor(options: Options);
        resolve(opts: ResolveOptions): Promise<ResolveResult | null>;
    }
}
