import webpack, { Entry } from 'webpack';
import { Externals } from '../common.types';
declare type MakeWebpackConfigOptions = {
    packageName: string;
    externals: Externals;
    debug?: boolean;
    entry: string | string[] | Entry;
    minifier: 'esbuild' | 'terser';
};
export default function makeWebpackConfig({ packageName, entry, externals, debug, minifier, }: MakeWebpackConfigOptions): webpack.Configuration;
export {};
