"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const autoprefixer_1 = __importDefault(require("autoprefixer"));
const terser_webpack_plugin_1 = __importDefault(require("terser-webpack-plugin"));
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const csso_webpack_plugin_1 = __importDefault(require("csso-webpack-plugin"));
const write_file_webpack_plugin_1 = __importDefault(require("write-file-webpack-plugin"));
const log = require('debug')('bp:webpack');
const escape_string_regexp_1 = __importDefault(require("escape-string-regexp"));
const builtin_modules_1 = __importDefault(require("builtin-modules"));
const webpack_1 = __importDefault(require("webpack"));
const esbuild_loader_1 = require("esbuild-loader");
const path_1 = __importDefault(require("path"));
// @ts-ignore
const plugin_1 = __importDefault(require("vue-loader/lib/plugin"));
function makeWebpackConfig({ packageName, entry, externals, debug, minifier, }) {
    const externalsRegex = makeExternalsRegex(externals.externalPackages);
    const isExternalRequest = (request) => {
        const isPeerDep = externals.externalPackages.length
            ? externalsRegex.test(request)
            : false;
        const isBuiltIn = externals.externalBuiltIns.includes(request);
        return isPeerDep || isBuiltIn;
    };
    log('external packages %o', externalsRegex);
    const builtInNode = {};
    builtin_modules_1.default.forEach(mod => {
        builtInNode[mod] = 'empty';
    });
    builtInNode['setImmediate'] = false;
    builtInNode['console'] = false;
    builtInNode['process'] = false;
    builtInNode['Buffer'] = false;
    // Don't mark an import as built in if it is the name of the package itself
    // eg. `events`
    if (builtInNode[packageName]) {
        builtInNode[packageName] = false;
    }
    // @ts-ignore
    return {
        entry: entry,
        mode: 'production',
        // bail: true,
        devtool: false,
        optimization: {
            chunkIds: 'named',
            runtimeChunk: { name: 'runtime' },
            minimize: true,
            splitChunks: {
                cacheGroups: {
                    styles: {
                        name: 'main',
                        test: /\.css$/,
                        chunks: 'all',
                        enforce: true,
                    },
                },
            },
            // @ts-ignore: Appears that the library CssoWebpackPlugin might have incorrect definitions
            minimizer: [
                ...(minifier === 'terser'
                    ? [
                        new terser_webpack_plugin_1.default({
                            parallel: true,
                            terserOptions: {
                                ie8: false,
                                output: {
                                    comments: false,
                                },
                            },
                        }),
                    ]
                    : [
                        new esbuild_loader_1.ESBuildMinifyPlugin({
                            target: 'esnext',
                        }),
                    ]),
                new csso_webpack_plugin_1.default({ restructure: false }),
            ],
        },
        plugins: [
            new webpack_1.default.IgnorePlugin({ resourceRegExp: /^electron$/ }),
            new plugin_1.default(),
            new mini_css_extract_plugin_1.default({
                // Options similar to the same options in webpackOptions.output
                // both options are optional
                filename: '[name].bundle.css',
                chunkFilename: '[id].bundle.css',
            }),
            ...(debug ? [new write_file_webpack_plugin_1.default()] : []),
        ],
        resolve: {
            modules: ['node_modules'],
            cacheWithContext: false,
            extensions: [
                '.web.mjs',
                '.mjs',
                '.web.js',
                '.js',
                '.mjs',
                '.json',
                '.css',
                '.sass',
                '.scss',
                '.svelte',
            ],
            alias: {
                svelte: path_1.default.resolve('node_modules', 'svelte'),
            },
            mainFields: ['browser', 'module', 'main', 'style'],
        },
        module: {
            unsafeCache: true,
            rules: [
                {
                    test: /\.css$/,
                    use: [mini_css_extract_plugin_1.default.loader, require.resolve('css-loader')],
                },
                // see https://github.com/apollographql/react-apollo/issues/1737
                {
                    type: 'javascript/auto',
                    test: /\.mjs$/,
                    use: [],
                },
                {
                    test: /\.vue$/,
                    loader: require.resolve('vue-loader'),
                },
                {
                    test: /\.(html|svelte)$/,
                    use: {
                        loader: require.resolve('svelte-loader'),
                        options: {
                            emitCss: true,
                        },
                    },
                },
                {
                    // required to prevent errors from Svelte on Webpack 5+, omit on Webpack 4
                    test: /node_modules\/svelte\/.*\.mjs$/,
                    resolve: {
                        fullySpecified: false,
                    },
                },
                {
                    test: /\.(scss|sass)$/,
                    use: [
                        mini_css_extract_plugin_1.default.loader,
                        require.resolve('css-loader'),
                        {
                            loader: require.resolve('postcss-loader'),
                            options: {
                                plugins: () => [(0, autoprefixer_1.default)()],
                            },
                        },
                        require.resolve('sass-loader'),
                    ],
                },
                {
                    test: /\.less$/,
                    use: [
                        mini_css_extract_plugin_1.default.loader,
                        require.resolve('css-loader'),
                        {
                            loader: require.resolve('postcss-loader'),
                            options: {
                                plugins: () => [
                                    (0, autoprefixer_1.default)({
                                        browsers: [
                                            'last 5 Chrome versions',
                                            'last 5 Firefox versions',
                                            'Safari >= 8',
                                            'Explorer >= 10',
                                            'edge >= 12',
                                        ],
                                    }),
                                ],
                            },
                        },
                        {
                            loader: require.resolve('less-loader'),
                            options: {
                                webpackImporter: true,
                            },
                        },
                    ],
                },
                {
                    test: /\.(woff|woff2|eot|ttf|svg|png|jpeg|jpg|gif|webp)$/,
                    loader: require.resolve('file-loader'),
                    options: {
                        name: '[name].bundle.[ext]',
                        emitFile: true,
                    },
                },
            ],
        },
        node: builtInNode,
        output: {
            filename: '[name].bundle.js',
            pathinfo: false,
        },
        externals: ({ context, request }, callback) => request && isExternalRequest(request)
            ? callback(undefined, 'commonjs ' + request)
            : callback(),
    };
}
exports.default = makeWebpackConfig;
function makeExternalsRegex(externals) {
    let externalsRegex = externals
        .map(dep => `^${(0, escape_string_regexp_1.default)(dep)}$|^${(0, escape_string_regexp_1.default)(dep)}\\/`)
        .join('|');
    externalsRegex = `(${externalsRegex})`;
    return new RegExp(externalsRegex);
}
