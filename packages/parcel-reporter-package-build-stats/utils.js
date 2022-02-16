"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notEmpty = exports.getPackageJSONDetails = exports.getDependencyFromSpecifier = exports.isSpecifierNotIgnored = exports.isPackageSpecifier = exports.readJSONFileFromFS = exports.readJSONFile = exports.getPackageRoot = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const memoizee_1 = __importDefault(require("memoizee"));
const find_up_1 = __importDefault(require("find-up"));
const getPackageRoot = (filePath, specifier) => {
    const parts = filePath.split(path_1.default.sep);
    if (parts.includes('node_modules')) {
        const lastNodeModules = parts.lastIndexOf('node_modules');
        const isScopedPackage = parts[lastNodeModules + 1].startsWith('@');
        const packageRoot = parts
            .slice(0, lastNodeModules + (isScopedPackage ? 3 : 2))
            .join(path_1.default.sep);
        return {
            packageRoot,
            packageName: isScopedPackage
                ? [parts[lastNodeModules + 1], parts[lastNodeModules + 2]].join(path_1.default.sep)
                : parts[lastNodeModules + 1],
        };
    }
    else {
        // Likely a top level main package route
        const packageJSONPath = find_up_1.default.sync('package.json', {
            cwd: filePath,
        });
        if (packageJSONPath) {
            return {
                packageRoot: path_1.default.dirname(packageJSONPath),
                packageName: specifier,
            };
        }
        else {
            throw new Error(`Could not find package.json for ${filePath} - are you sure you're in a package root?`);
        }
    }
};
exports.getPackageRoot = getPackageRoot;
const readJSONFile = async (filePath) => {
    const fileContents = await promises_1.default.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
};
exports.readJSONFile = readJSONFile;
const readJSONFileFromFS = async (fs, filePath) => {
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
};
exports.readJSONFileFromFS = readJSONFileFromFS;
const isPackageSpecifier = (specifier) => !(specifier.startsWith('.') || specifier.startsWith('/'));
exports.isPackageSpecifier = isPackageSpecifier;
const isSpecifierNotIgnored = (specifier, peerDependencies) => !peerDependencies[(0, exports.getDependencyFromSpecifier)(specifier)];
exports.isSpecifierNotIgnored = isSpecifierNotIgnored;
const getDependencyFromSpecifier = (specifier) => {
    const parts = specifier.split('/');
    const depNameFromSpecifier = parts[0].startsWith('@')
        ? [parts[0], parts[1]].join(path_1.default.sep)
        : parts[0];
    return depNameFromSpecifier;
};
exports.getDependencyFromSpecifier = getDependencyFromSpecifier;
exports.getPackageJSONDetails = (0, memoizee_1.default)(async (packageRoot) => {
    const requireeJSON = await (0, exports.readJSONFile)(path_1.default.join(packageRoot, 'package.json'));
    return Object.assign({ dependencies: {}, peerDependencies: {} }, requireeJSON);
}, { max: 1000 });
function notEmpty(value) {
    return value !== null && value !== undefined;
}
exports.notEmpty = notEmpty;
//# sourceMappingURL=utils.js.map