import { StatsCompilation } from 'webpack';
import { BundleGraph, PackagedBundle } from '@parcel/types';
/**
 * A fork of `webpack-bundle-size-analyzer`.
 * https://github.com/robertknight/webpack-bundle-size-analyzer
 */
export declare function getDependencySizeTreeNext(packageName: string, bundleGraph: BundleGraph<PackagedBundle>): void;
declare function bundleSizeTree(packageName: string, stats: StatsCompilation, minifier: 'terser' | 'esbuild'): Promise<{
    name: string;
    approximateSize: number;
}[]>;
export default bundleSizeTree;
