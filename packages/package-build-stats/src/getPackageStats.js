"use strict";
/**
 * Parts of the code are inspired from the `import-cost` project
 * @see https://github.com/wix/import-cost/blob/master/packages/import-cost/src/webpack.js
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const common_utils_1 = require("./utils/common.utils");
const installation_utils_1 = __importDefault(require("./utils/installation.utils"));
const build_utils_1 = __importDefault(require("./utils/build.utils"));
const CustomError_1 = require("./errors/CustomError");
const telemetry_utils_1 = __importDefault(require("./utils/telemetry.utils"));
const perf_hooks_1 = require("perf_hooks");
function getPackageJSONDetails(packageName, installPath) {
    const startTime = perf_hooks_1.performance.now();
    const packageJSONPath = path_1.default.join(installPath, 'node_modules', packageName, 'package.json');
    return fs_1.promises.readFile(packageJSONPath, 'utf8').then((contents) => {
        const parsedJSON = JSON.parse(contents);
        telemetry_utils_1.default.getPackageJSONDetails(packageName, true, startTime);
        return {
            dependencyCount: 'dependencies' in parsedJSON
                ? Object.keys(parsedJSON.dependencies).length
                : 0,
            mainFields: [
                parsedJSON['module'] && 'module',
                parsedJSON['jsnext:main'] && 'jsnext:main',
                parsedJSON['main'] && 'main',
                parsedJSON['style'] && 'style',
            ].filter(Boolean),
            hasJSNext: parsedJSON['jsnext:main'] || false,
            hasJSModule: parsedJSON['module'] || false,
            isModuleType: parsedJSON['type'] === 'module',
            hasSideEffects: 'sideEffects' in parsedJSON ? parsedJSON['sideEffects'] : true,
            peerDependencies: 'peerDependencies' in parsedJSON
                ? Object.keys(parsedJSON.peerDependencies)
                : [],
        };
    }, err => {
        telemetry_utils_1.default.getPackageJSONDetails(packageName, false, startTime, err);
    });
}
async function getPackageStats(packageString, optionsRaw) {
    var _a, _b, _c;
    const startTime = perf_hooks_1.performance.now();
    const defaultMinifier = 'terser';
    const options = Object.assign({ minifier: defaultMinifier }, optionsRaw);
    const { name: packageName, isLocal } = (0, common_utils_1.parsePackageString)(packageString);
    const installPath = await installation_utils_1.default.preparePath(packageName);
    if (options.debug) {
        console.log('Install path:', installPath);
    }
    try {
        await installation_utils_1.default.installPackage(packageString, installPath, {
            isLocal,
            client: options.client,
            limitConcurrency: options.limitConcurrency,
            networkConcurrency: options.networkConcurrency,
            installTimeout: options.installTimeout,
        });
        const externals = (0, common_utils_1.getExternals)(packageName, installPath);
        const [packageJSONDetails, builtDetails] = await Promise.all([
            getPackageJSONDetails(packageName, installPath),
            build_utils_1.default.buildPackageIgnoringMissingDeps({
                name: packageName,
                installPath,
                externals,
                options: {
                    debug: options.debug,
                    customImports: options.customImports,
                    minifier: options.minifier,
                    includeDependencySizes: true,
                },
            }),
        ]);
        if (!packageJSONDetails) {
            throw new CustomError_1.UnexpectedBuildError(`Could not get package.json details for ${packageName}`);
        }
        if (!builtDetails) {
            throw new CustomError_1.BuildError(`Could not get built details for ${packageName}`);
        }
        const isStylePackageOnly = packageJSONDetails.mainFields.length === 1 &&
            packageJSONDetails.mainFields[0] === 'style';
        if (isStylePackageOnly) {
            builtDetails.assets = (_a = builtDetails.assets) === null || _a === void 0 ? void 0 : _a.filter(asset => (asset === null || asset === void 0 ? void 0 : asset.type) !== 'js');
        }
        const hasCSSAsset = (_b = builtDetails.assets) === null || _b === void 0 ? void 0 : _b.some(asset => (asset === null || asset === void 0 ? void 0 : asset.type) === 'css');
        const mainAsset = (_c = builtDetails.assets) === null || _c === void 0 ? void 0 : _c.find(asset => (asset === null || asset === void 0 ? void 0 : asset.name) === 'main' && (asset === null || asset === void 0 ? void 0 : asset.type) === (hasCSSAsset ? 'css' : 'js'));
        if (!mainAsset) {
            throw new CustomError_1.UnexpectedBuildError('Did not find a main asset in the built bundle');
        }
        telemetry_utils_1.default.packageStats(packageString, true, perf_hooks_1.performance.now() - startTime, options);
        return Object.assign(Object.assign(Object.assign({}, packageJSONDetails), builtDetails), { buildVersion: require('../package.json').version, size: mainAsset.size, gzip: mainAsset.gzip, parse: mainAsset.parse });
    }
    catch (e) {
        telemetry_utils_1.default.packageStats(packageString, false, perf_hooks_1.performance.now() - startTime, options);
        throw e;
    }
    finally {
        if (!options.debug) {
            await installation_utils_1.default.cleanupPath(installPath);
        }
    }
}
exports.default = getPackageStats;
//# sourceMappingURL=getPackageStats.js.map