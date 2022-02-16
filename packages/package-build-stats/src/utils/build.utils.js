"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const log = require('debug')('bp:worker');
const is_valid_npm_name_1 = __importDefault(require("is-valid-npm-name"));
const zlib_1 = require("zlib");
const fs_1 = __importDefault(require("fs"));
const getDependencySizeTree_1 = require("../getDependencySizeTree");
const getParseTime_1 = __importDefault(require("../getParseTime"));
const perf_hooks_1 = require("perf_hooks");
const fs_2 = require("@parcel/fs");
const core_1 = __importStar(require("@parcel/core"));
const CustomError_1 = require("../errors/CustomError");
const telemetry_utils_1 = __importDefault(require("./telemetry.utils"));
const common_utils_1 = require("./common.utils");
let workerFarm = (0, core_1.createWorkerFarm)({
    forcedKillTime: 5,
});
let outputFS = new fs_2.MemoryFS(workerFarm);
function notEmpty(value) {
    return value !== null && value !== undefined;
}
function isDiagnosticError(error) {
    return 'diagnostics' in error;
}
const BuildUtils = {
    createEntryPoint(packageName, installPath, options) {
        const entryPath = path_1.default.join(installPath, options.entryFilename || 'index.js');
        let importStatement;
        if (options.esm) {
            if (options.customImports) {
                importStatement = `
          import { ${options.customImports.join(', ')} } from '${packageName}'; 
          console.log(${options.customImports.join(', ')})
     `;
            }
            else {
                importStatement = `import p from '${packageName}'; console.log(p)`;
            }
        }
        else {
            if (options.customImports) {
                importStatement = `
        const { ${options.customImports.join(', ')} } = require('${packageName}'); 
        console.log(${options.customImports.join(', ')})
        `;
            }
            else {
                importStatement = `const p = require('${packageName}'); console.log(p)`;
            }
        }
        try {
            fs_1.default.writeFileSync(entryPath, importStatement, 'utf-8');
            return entryPath;
        }
        catch (err) {
            throw new CustomError_1.EntryPointError(err);
        }
    },
    async compilePackage({ name, entry, externals, debug, minifier, installPath, }) {
        const startTime = perf_hooks_1.performance.now();
        const nodeFS = new fs_2.NodeFS();
        await (0, common_utils_1.updateProjectPeerDependencies)(installPath, Object.fromEntries(externals.externalPackages.map(packageName => [packageName, '*'])));
        console.log('Building file: ', entry);
        let bundler = new core_1.default({
            entries: entry.main,
            mode: 'production',
            env: Object.assign(Object.assign({}, process.env), {
                NODE_ENV: 'production',
            }),
            defaultConfig: '@parcel/config-default',
            shouldAutoInstall: false,
            workerFarm,
            // outputFS,
            config: require.resolve('../../.parcelrc'),
            shouldDisableCache: true,
            defaultTargetOptions: {
                sourceMaps: true,
                shouldOptimize: true,
                shouldScopeHoist: true,
                isLibrary: false,
                engines: {
                    browsers: [
                        'last 5 Chrome versions',
                        'last 5 Firefox versions',
                        'Safari >= 9',
                        'edge >= 12',
                    ],
                },
            },
            // targets: {
            // main: {
            //     // includeNodeModules: true,
            //     distDir: 'parcel-dist',
            //     engines: {
            //       browsers: [
            //         'last 5 Chrome versions',
            //         'last 5 Firefox versions',
            //         'Safari >= 9',
            //         'edge >= 12',
            //       ],
            //     },
            // },
            // },
        });
        const assets = [];
        try {
            let { bundleGraph, buildTime } = await bundler.run();
            (0, getDependencySizeTree_1.getDependencySizeTreeNext)(name, bundleGraph);
            for (let bundle of bundleGraph.getBundles()) {
                console.log(bundle, bundle.stats, bundle.getMainEntry(), bundle.filePath, bundle.name);
                assets.push({
                    file: bundle.filePath,
                    size: bundle.stats.size,
                });
                bundle.traverseAssets(asset => {
                    asset.getDependencies().map(a => ({
                        target: a.target,
                        specifier: a.specifier,
                        sourcePath: a.sourcePath,
                        resolveFrom: a.resolveFrom,
                    }));
                    let filePath = path_1.default.normalize(asset.filePath);
                    // console.log(
                    //   'ASSET: ',
                    //   {
                    //     ...asset,
                    //     filePath: asset.filePath,
                    //     type: asset.type,
                    //     isSource: asset.isSource,
                    //     meta: asset.meta,
                    //     k: asset.symbols,
                    //   },
                    //   asset.getDependencies().map(a => ({
                    //     isEntry: a.isEntry,
                    //     sourceAssetType: a.sourceAssetType,
                    //     sourcePath: a.sourcePath,
                    //   })),
                    //   asset.stats
                    // )
                });
            }
            telemetry_utils_1.default.compilePackage(name, true, startTime, { minifier });
        }
        catch (err) {
            console.log('Parcel failed becase ', err);
            telemetry_utils_1.default.compilePackage(name, false, startTime, { minifier }, err);
            throw err;
        }
        return { assets };
    },
    _parseMissingModules(errors) {
        const missingModuleErrors = errors.filter(error => error.message.startsWith('Failed to resolve') &&
            error.origin === '@parcel/core');
        if (!missingModuleErrors.length) {
            return [];
        }
        // There's a better way to get the missing module's name, maybe ?
        const missingModuleRegex = /Failed to resolve '(.+)' from/;
        const missingModules = missingModuleErrors.map(err => {
            const matches = err.message.match(missingModuleRegex);
            if (!matches) {
                throw new CustomError_1.UnexpectedBuildError('Expected to find a file path in the module not found error, but found none. Regex for this might be out of date.');
            }
            const missingFilePath = matches[1];
            let packageNameMatch;
            if (missingFilePath.startsWith('@')) {
                packageNameMatch = missingFilePath.match(/@[^\/]+\/[^\/]+/); // @babel/runtime/object/create -> @babel/runtime
            }
            else {
                packageNameMatch = missingFilePath.match(/[^\/]+/); // babel-runtime/object/create -> babel-runtime
            }
            if (!packageNameMatch) {
                throw new CustomError_1.UnexpectedBuildError('Failed to resolve the missing package name. Regex for this might be out of date.');
            }
            return packageNameMatch[0];
        });
        let uniqueMissingModules = Array.from(new Set(missingModules));
        uniqueMissingModules = uniqueMissingModules.filter(mod => !mod.startsWith(`${uniqueMissingModules[0]}/`));
        return uniqueMissingModules;
    },
    async buildPackage({ name, installPath, externals, options, }) {
        let entry = {};
        if (options.splitCustomImports) {
            if (!options.customImports || !options.customImports.length) {
                return { assets: [] };
            }
            options.customImports.forEach((importt) => {
                entry[importt] = BuildUtils.createEntryPoint(name, installPath, {
                    customImports: [importt],
                    entryFilename: importt,
                    esm: true,
                });
            });
        }
        else {
            entry['main'] = BuildUtils.createEntryPoint(name, installPath, {
                esm: false,
                customImports: options.customImports,
            });
        }
        log('build start %s', name);
        try {
            const { assets } = await BuildUtils.compilePackage({
                name,
                entry,
                installPath,
                externals,
                debug: options.debug,
                minifier: options.minifier,
            });
            log('build end %s', name);
            console.log('after compile assets ', assets);
            log('build end %s', name);
            const getAssetStats = (asset) => {
                if (!asset.file)
                    return null;
                const bundleContents = fs_1.default.readFileSync(asset.file, 'utf8');
                let parseTimes = null;
                if (options.calcParse) {
                    parseTimes = (0, getParseTime_1.default)(bundleContents);
                }
                const gzip = (0, zlib_1.gzipSync)(bundleContents, {}).length;
                const { ext, name } = path_1.default.parse(asset.file);
                return {
                    name: name,
                    type: ext.slice(1),
                    size: asset.size,
                    gzip,
                    parse: parseTimes,
                };
            };
            const assetStats = assets
                .filter(asset => !!asset.file)
                .map(getAssetStats)
                .filter(notEmpty);
            return {
                assets: assetStats || [],
                // ...(options.includeDependencySizes && {
                //   dependencySizes: await getDependencySizes(
                //     name,
                //     // jsonStats,
                //     options.minifier
                //   )
                // })
            };
        }
        catch (error) {
            if (isDiagnosticError(error)) {
                const missingModules = BuildUtils._parseMissingModules(error.diagnostics);
                if (missingModules.length) {
                    if (missingModules.length === 1 && missingModules[0] === name) {
                        throw new CustomError_1.EntryPointError(error.diagnostics);
                    }
                    else {
                        throw new CustomError_1.MissingDependencyError(error.diagnostics, {
                            missingModules,
                        });
                    }
                }
                else {
                    throw new CustomError_1.BuildError(error);
                }
            }
            else {
                throw new CustomError_1.BuildError(error);
            }
        }
    },
    async buildPackageIgnoringMissingDeps({ name, externals, installPath, options, }) {
        const buildStartTime = perf_hooks_1.performance.now();
        let buildIteration = 1;
        try {
            const buildResult = await BuildUtils.buildPackage({
                name,
                externals,
                installPath,
                options,
            });
            telemetry_utils_1.default.buildPackage(name, true, buildStartTime, Object.assign(Object.assign({}, options), { buildIteration }));
            return buildResult;
        }
        catch (e) {
            buildIteration++;
            if (e instanceof CustomError_1.MissingDependencyError &&
                e.missingModules.length <= 6 &&
                e.missingModules.every(mod => (0, is_valid_npm_name_1.default)(mod))) {
                const { missingModules } = e.extra;
                const newExternals = Object.assign(Object.assign({}, externals), { externalPackages: externals.externalPackages.concat(missingModules) });
                log('%s has missing dependencies, rebuilding without %o', name, missingModules);
                const rebuiltResult = await BuildUtils.buildPackage({
                    name,
                    externals: newExternals,
                    installPath,
                    options,
                });
                telemetry_utils_1.default.buildPackage(name, true, buildStartTime, Object.assign(Object.assign({}, options), { buildIteration,
                    missingModules }));
                return Object.assign({ ignoredMissingDependencies: missingModules }, rebuiltResult);
            }
            else {
                telemetry_utils_1.default.buildPackage(name, false, buildStartTime, Object.assign(Object.assign({}, options), { buildIteration }), e);
                throw e;
            }
        }
    },
};
exports.default = BuildUtils;
//# sourceMappingURL=build.utils.js.map