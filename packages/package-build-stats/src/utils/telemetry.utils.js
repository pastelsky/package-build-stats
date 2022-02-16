"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitter = void 0;
const mitt_1 = __importDefault(require("mitt"));
const common_utils_1 = require("./common.utils");
const perf_hooks_1 = require("perf_hooks");
const lodash_1 = __importDefault(require("lodash"));
const debug = require('debug')('bp-telemetry');
const emitter = (0, mitt_1.default)();
exports.emitter = emitter;
emitter.on('*', (type, data) => {
    debug('Telementry Event: %s  %o', type, data);
});
function errorToObject(error) {
    if (!error)
        return;
    if (error && typeof error === 'object') {
        const errorObject = {};
        Object.getOwnPropertyNames(error).forEach(key => {
            // @ts-ignore
            errorObject[key] =
                typeof error[key] === 'object'
                    ? errorToObject(error[key])
                    : String(error[key]).substring(0, 40);
        });
        return errorObject;
    }
    return { error };
}
class Telemetry {
    static installPackage(packageString, isSuccessful, startTime, options, error = null) {
        emitter.emit('TASK_PACKAGE_INSTALL', {
            package: (0, common_utils_1.parsePackageString)(packageString),
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            options,
            error: errorToObject(error),
        });
    }
    static getPackageJSONDetails(packageName, isSuccessful, startTime, error = null) {
        emitter.emit('TASK_PACKAGE_JSON_DETAILS', {
            package: { name: packageName },
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            error: errorToObject(error),
        });
    }
    static buildPackage(packageName, isSuccessful, startTime, options, error = null) {
        emitter.emit('TASK_PACKAGE_BUILD', {
            package: { name: packageName },
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            options: lodash_1.default.omit(options, 'customImports'),
            error: errorToObject(error),
        });
    }
    static compilePackage(packageName, isSuccessful, startTime, options, error = null) {
        emitter.emit('TASK_PACKAGE_COMPILE', {
            packageName,
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            options,
            error: errorToObject(error),
        });
    }
    static packageStats(packageString, isSuccessful, startTime, options, error = null) {
        emitter.emit('TASK_PACKAGE_STATS', {
            package: (0, common_utils_1.parsePackageString)(packageString),
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            options,
            error: errorToObject(error),
        });
    }
    static parseWebpackStats(packageName, isSuccessful, startTime, error = null) {
        emitter.emit('TASK_PACKAGE_PARSE_WEBPACK_STATS', {
            package: { name: packageName },
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            error: errorToObject(error),
        });
    }
    static dependencySizes(packageName, startTime, isSuccessful, options, error = null) {
        emitter.emit('TASK_PACKAGE_DEPENDENCY_SIZES', {
            package: { name: packageName },
            duration: perf_hooks_1.performance.now() - startTime,
            isSuccessful,
            options,
            error: errorToObject(error),
        });
    }
    static assetsGZIPParseTime(packageName, startTime) {
        emitter.emit('TASK_PACKAGE_ASSETS_GZIP_PARSE_TIME', {
            package: { name: packageName },
            duration: perf_hooks_1.performance.now() - startTime,
        });
    }
    static walkPackageExportsTree(packageString, startTime, isSuccessful, error = null) {
        emitter.emit('TASK_PACKAGE_EXPORTS_TREEWALK', {
            package: (0, common_utils_1.parsePackageString)(packageString),
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            error: errorToObject(error),
        });
    }
    static packageExports(packageString, startTime, isSuccessful, error = null) {
        emitter.emit('TASK_PACKAGE_EXPORTS', {
            package: (0, common_utils_1.parsePackageString)(packageString),
            isSuccessful,
            duration: perf_hooks_1.performance.now() - startTime,
            error: errorToObject(error),
        });
    }
    static packageExportsSizes(packageString, startTime, isSuccessful, options, error = null) {
        emitter.emit('TASK_PACKAGE_EXPORTS_SIZES', {
            package: (0, common_utils_1.parsePackageString)(packageString),
            duration: perf_hooks_1.performance.now() - startTime,
            isSuccessful,
            error: errorToObject(error),
            options,
        });
    }
}
exports.default = Telemetry;
//# sourceMappingURL=telemetry.utils.js.map