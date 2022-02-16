"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllExports = exports.getExportsDetails = void 0;
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const enhanced_resolve_1 = __importDefault(require("enhanced-resolve"));
const makeWebpackConfig_1 = __importDefault(require("../config/makeWebpackConfig"));
const telemetry_utils_1 = __importDefault(require("./telemetry.utils"));
const perf_hooks_1 = require("perf_hooks");
const assertUnreachable = (x) => {
    throw new Error("Didn't expect to get here");
};
/**
 * Parses code to return all named (and default exports)
 * as well as `export * from` locations
 */
function getExportsDetails(code) {
    const ast = (0, parser_1.parse)(code, {
        sourceType: 'module',
        allowUndeclaredExports: true,
        plugins: ['exportDefaultFrom'],
    });
    const exportAllLocations = [];
    let exportsList = [];
    const processObjectPattern = (properties, result = []) => {
        properties.forEach(property => {
            switch (property.type) {
                case 'RestElement':
                    if (property.argument.type === 'Identifier') {
                        result.push(property.argument.name);
                    }
                    break;
                case 'ObjectProperty':
                    if (property.value.type === 'Identifier') {
                        result.push(property.value.name);
                    }
                    break;
                // default:
                //   assertUnreachable(property.type)
            }
        });
    };
    const processAssignmentPattern = (element, result = []) => {
        switch (element.left.type) {
            case 'Identifier':
                result.push(element.left.name);
                break;
            case 'ArrayPattern':
                processArrayPattern(element.left.elements, result);
                break;
            case 'ObjectPattern':
                processObjectPattern(element.left.properties, result);
                break;
            case 'MemberExpression':
                // unhandled
                break;
            // default:
            //   assertUnreachable(element.left.type)
        }
    };
    const processRestElement = (element, result = []) => {
        if (element.argument.type === 'Identifier') {
            result.push(element.argument.name);
        }
    };
    const processArrayPattern = (elements, result = []) => {
        elements.forEach(element => {
            if (element) {
                switch (element.type) {
                    case 'Identifier':
                        result.push(element.name);
                        break;
                    case 'RestElement':
                        processRestElement(element, result);
                        break;
                    case 'ArrayPattern':
                        processArrayPattern(element.elements, result);
                        break;
                    case 'ObjectPattern':
                        processObjectPattern(element.properties, result);
                        break;
                    case 'AssignmentPattern':
                        processAssignmentPattern(element, result);
                        break;
                    // default:
                    //   assertUnreachable(element.type)
                }
            }
        });
    };
    (0, traverse_1.default)(ast, {
        ExportNamedDeclaration(path) {
            const { specifiers, declaration } = path.node;
            if (declaration) {
                switch (declaration.type) {
                    case 'VariableDeclaration':
                        declaration.declarations.forEach(dec => {
                            switch (dec.id.type) {
                                case 'ObjectPattern':
                                    processObjectPattern(dec.id.properties, exportsList);
                                    break;
                                case 'ArrayPattern':
                                    processArrayPattern(dec.id.elements, exportsList);
                                    break;
                                case 'AssignmentPattern':
                                    processAssignmentPattern(dec.id, exportsList);
                                    break;
                                case 'RestElement':
                                    processRestElement(dec.id, exportsList);
                                    break;
                                case 'Identifier':
                                    exportsList.push(dec.id.name);
                                    break;
                                case 'MemberExpression':
                                case 'TSParameterProperty':
                                    // unhandled
                                    break;
                                // default:
                                //   assertUnreachable(dec.id.type)
                            }
                        });
                        break;
                    case 'FunctionDeclaration':
                    case 'ClassDeclaration':
                        if (declaration.id) {
                            exportsList.push(declaration.id.name);
                        }
                        break;
                    case 'TSModuleDeclaration':
                    case 'TSEnumDeclaration':
                    case 'DeclareModule':
                    case 'DeclareInterface':
                    case 'DeclareModuleExports':
                    case 'DeclareOpaqueType':
                    case 'DeclareVariable':
                    case 'DeclareExportDeclaration':
                    case 'DeclareExportAllDeclaration':
                    case 'DeclareClass':
                    case 'TSTypeAliasDeclaration':
                    case 'OpaqueType':
                    case 'TypeAlias':
                    case 'TSDeclareFunction':
                    case 'TSInterfaceDeclaration':
                    case 'InterfaceDeclaration':
                    case 'DeclareTypeAlias':
                    case 'DeclareFunction':
                    case 'ExportDefaultDeclaration':
                    case 'ExportAllDeclaration':
                    case 'ExportNamedDeclaration':
                    case 'ImportDeclaration':
                        // unhandled
                        break;
                    // default:
                    //   assertUnreachable(declaration.type)
                }
            }
            else {
                specifiers.forEach(specifier => {
                    exportsList.push(specifier.exported.name);
                });
            }
        },
        ExportDefaultDeclaration() {
            exportsList.push('default');
        },
        ExportAllDeclaration(path) {
            exportAllLocations.push(path.node.source.value);
        },
    });
    return {
        exportAllLocations,
        exports: exportsList,
    };
}
exports.getExportsDetails = getExportsDetails;
const webpackConfig = (0, makeWebpackConfig_1.default)({
    packageName: '',
    entry: '',
    externals: { externalPackages: [], externalBuiltIns: [] },
    minifier: 'terser',
});
const resolver = enhanced_resolve_1.default.create({
    extensions: (_a = webpackConfig === null || webpackConfig === void 0 ? void 0 : webpackConfig.resolve) === null || _a === void 0 ? void 0 : _a.extensions,
    modules: (_b = webpackConfig === null || webpackConfig === void 0 ? void 0 : webpackConfig.resolve) === null || _b === void 0 ? void 0 : _b.modules,
    // @ts-ignore Error due to unsynced types for enhanced resolve and webpack
    mainFields: (_c = webpackConfig === null || webpackConfig === void 0 ? void 0 : webpackConfig.resolve) === null || _c === void 0 ? void 0 : _c.mainFields,
    conditionNames: ['module', 'import', 'style', 'default'],
});
const resolve = async (context, path) => new Promise((resolve, reject) => {
    resolver(context, path, (err, result) => {
        if (err) {
            reject(err);
        }
        else {
            resolve(result);
        }
    });
});
/**
 * Recursively get all exports starting
 * from a given path
 */
async function getAllExports(packageString, context, lookupPath) {
    const startTime = perf_hooks_1.performance.now();
    const getAllExportsRecursive = async (ctx, lookPath) => {
        const resolvedPath = await resolve(ctx, lookPath);
        const resolvedExports = {};
        const code = await fs_1.promises.readFile(resolvedPath, 'utf8');
        const { exports, exportAllLocations } = getExportsDetails(code);
        exports.forEach(exp => {
            const relativePath = resolvedPath.substring(resolvedPath.indexOf(context) + context.length + 1);
            resolvedExports[exp] = relativePath;
        });
        const promises = exportAllLocations.map(async (location) => {
            const exports = await getAllExportsRecursive(path_1.default.dirname(resolvedPath), location);
            Object.keys(exports).forEach(expKey => {
                resolvedExports[expKey] = exports[expKey];
            });
        });
        await Promise.all(promises);
        return resolvedExports;
    };
    try {
        const results = await getAllExportsRecursive(context, lookupPath);
        telemetry_utils_1.default.walkPackageExportsTree(packageString, startTime, true);
        return results;
    }
    catch (err) {
        telemetry_utils_1.default.walkPackageExportsTree(packageString, startTime, false, err);
        throw err;
    }
}
exports.getAllExports = getAllExports;
