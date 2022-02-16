"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackageExportSizes = exports.getAllPackageExports = void 0;
const telemetry_utils_1 = __importDefault(require("./utils/telemetry.utils"));
const perf_hooks_1 = require("perf_hooks");
const debug = require('debug')('bp:worker');
const common_utils_1 = require("./utils/common.utils");
const exports_utils_1 = require("./utils/exports.utils");
const installation_utils_1 = __importDefault(require("./utils/installation.utils"));
const build_utils_1 = __importDefault(require("./utils/build.utils"));
async function installPackage(packageString, installPath, options) {
    const { isLocal } = (0, common_utils_1.parsePackageString)(packageString);
    await installation_utils_1.default.installPackage(packageString, installPath, {
        isLocal,
        client: options.client,
        limitConcurrency: options.limitConcurrency,
        networkConcurrency: options.networkConcurrency,
        installTimeout: options.installTimeout,
    });
}
async function getAllPackageExports(packageString, options = {}) {
    const startTime = perf_hooks_1.performance.now();
    const { name: packageName, normalPath } = (0, common_utils_1.parsePackageString)(packageString);
    const installPath = await installation_utils_1.default.preparePath(packageName);
    try {
        await installPackage(packageString, installPath, options);
        const results = await (0, exports_utils_1.getAllExports)(packageString, normalPath || installPath, packageName);
        telemetry_utils_1.default.packageExports(packageString, startTime, true);
        return results;
    }
    catch (err) {
        telemetry_utils_1.default.packageExports(packageString, startTime, false, err);
        throw err;
    }
    finally {
        await installation_utils_1.default.cleanupPath(installPath);
    }
}
exports.getAllPackageExports = getAllPackageExports;
async function getPackageExportSizes(packageString, options = {
    minifier: 'terser',
}) {
    var _a;
    const startTime = perf_hooks_1.performance.now();
    const { name: packageName, normalPath } = (0, common_utils_1.parsePackageString)(packageString);
    const installPath = await installation_utils_1.default.preparePath(packageName);
    try {
        await installPackage(packageString, installPath, options);
        const exportMap = await (0, exports_utils_1.getAllExports)(packageString, normalPath || installPath, packageName);
        const exports = Object.keys(exportMap).filter(exp => !(exp === 'default'));
        debug('Got %d exports for %s', exports.length, packageString);
        const externals = (0, common_utils_1.getExternals)(packageName, installPath);
        const builtDetails = await build_utils_1.default.buildPackageIgnoringMissingDeps({
            name: packageName,
            installPath,
            externals,
            options: {
                customImports: exports,
                splitCustomImports: true,
                includeDependencySizes: false,
                minifier: options.minifier || 'terser',
            },
        });
        telemetry_utils_1.default.packageExportsSizes(packageString, startTime, true, options);
        return Object.assign(Object.assign({}, builtDetails), { buildVersion: require('../package.json').version, assets: (_a = builtDetails === null || builtDetails === void 0 ? void 0 : builtDetails.assets) === null || _a === void 0 ? void 0 : _a.map(asset => (Object.assign(Object.assign({}, asset), { path: exportMap[asset === null || asset === void 0 ? void 0 : asset.name] }))) });
    }
    catch (err) {
        telemetry_utils_1.default.packageExportsSizes(packageString, startTime, false, options, err);
        throw err;
    }
    finally {
        await installation_utils_1.default.cleanupPath(installPath);
    }
}
exports.getPackageExportSizes = getPackageExportSizes;
//# sourceMappingURL=getPackageExportSizes.js.map