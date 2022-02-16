"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rimraf_1 = __importDefault(require("rimraf"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const sanitize_filename_1 = __importDefault(require("sanitize-filename"));
const debug = require('debug')('bp:worker');
const CustomError_1 = require("../errors/CustomError");
const common_utils_1 = require("./common.utils");
const config_1 = __importDefault(require("../config/config"));
const telemetry_utils_1 = __importDefault(require("./telemetry.utils"));
const perf_hooks_1 = require("perf_hooks");
// When operating on a local directory, force npm to copy directory structure
// and all dependencies instead of just symlinking files
const wrapPackCommand = (packagePath) => `$(npm pack --ignore-scripts ${packagePath} | tail -1)`;
const InstallationUtils = {
    getInstallPath(packageName) {
        const id = 'ok'; //shortId.generate().slice(0, 3)
        return path_1.default.join(config_1.default.tmp, 'packages', (0, sanitize_filename_1.default)(`build-${packageName}-${id}`));
    },
    async preparePath(packageName) {
        const installPath = InstallationUtils.getInstallPath(packageName);
        await fs_1.promises.mkdir(config_1.default.tmp, { recursive: true });
        await fs_1.promises.mkdir(installPath, { recursive: true });
        await fs_1.promises.mkdir(path_1.default.join(installPath, '.git'), {
            recursive: true,
        });
        await fs_1.promises.writeFile(path_1.default.join(installPath, 'yarn.lock'), '');
        await fs_1.promises.writeFile(path_1.default.join(installPath, 'package.json'), JSON.stringify({
            source: './index.ts',
            main: './dist/main.js',
            targets: {
                main: {
                    optimize: true,
                    sourceMap: true,
                    scopeHoist: true,
                    isLibrary: false,
                    includeNodeModules: true,
                },
            },
            dependencies: {},
            browserslist: [
                'last 5 Chrome versions',
                'last 5 Firefox versions',
                'Safari >= 9',
                'edge >= 12',
            ],
        }));
        return installPath;
    },
    async installPackage(packageString, installPath, installOptions) {
        let flags, command;
        let installStartTime = perf_hooks_1.performance.now();
        const { client = 'npm', limitConcurrency, networkConcurrency, additionalPackages = [], isLocal, installTimeout = 30000, } = installOptions;
        if (client === 'yarn') {
            flags = [
                'ignore-flags',
                'ignore-engines',
                'skip-integrity-check',
                'exact',
                'json',
                'no-progress',
                'silent',
                'no-lockfile',
                'no-bin-links',
                'no-audit',
                'no-fund',
                'ignore-optional',
            ];
            if (limitConcurrency) {
                flags.push('mutex network');
            }
            if (networkConcurrency) {
                flags.push(`network-concurrency ${networkConcurrency}`);
            }
            command = `yarn add ${packageString} ${additionalPackages.join(' ')} --${flags.join(' --')}`;
        }
        else if (client === 'npm') {
            flags = [
                // Setting cache is required for concurrent `npm install`s to work
                `cache=${path_1.default.join(config_1.default.tmp, 'cache')}`,
                'no-package-lock',
                'no-shrinkwrap',
                'no-optional',
                'no-bin-links',
                'progress false',
                'loglevel error',
                'ignore-scripts',
                'save-exact',
                'production',
                'legacy-peer-deps',
                'json',
            ];
            command = `npm install ${isLocal ? wrapPackCommand(packageString) : packageString} ${additionalPackages.join(' ')} --${flags.join(' --')}`;
        }
        else if (client === 'pnpm') {
            flags = ['no-optional', 'loglevel error', 'ignore-scripts', 'save-exact'];
            command = `pnpm add ${packageString} ${additionalPackages.join(' ')} --${[].join(' --')}`;
        }
        else {
            console.error('No valid client specified');
            process.exit(1);
        }
        debug('install start %s', packageString);
        try {
            await (0, common_utils_1.exec)(command, {
                cwd: installPath,
                maxBuffer: 1024 * 500,
            }, installTimeout);
            debug('install finish %s', packageString);
            telemetry_utils_1.default.installPackage(packageString, true, installStartTime, installOptions);
        }
        catch (err) {
            console.log(err);
            telemetry_utils_1.default.installPackage(packageString, false, installStartTime, installOptions);
            if (typeof err === 'string' && err.includes('code E404')) {
                throw new CustomError_1.PackageNotFoundError(err);
            }
            else {
                throw new CustomError_1.InstallError(err);
            }
        }
    },
    async cleanupPath(installPath) {
        return; /// PLESE REMOVE THIS
        const noop = () => { };
        try {
            await (0, rimraf_1.default)(installPath, noop);
        }
        catch (err) {
            console.error('cleaning up path ', installPath, ' failed due to ', err);
        }
    },
};
exports.default = InstallationUtils;
//# sourceMappingURL=installation.utils.js.map