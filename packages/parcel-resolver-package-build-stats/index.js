"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("@parcel/plugin");
const node_resolver_core_1 = __importDefault(require("@parcel/node-resolver-core"));
const path_1 = __importDefault(require("path"));
// Throw user friendly errors on special webpack loader syntax
// ex. `imports-loader?$=jquery!./example.js`
const WEBPACK_IMPORT_REGEX = /^\w+-loader(?:\?\S*)?!/;
const readJSONFile = async (fs, filePath) => {
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
};
/**
 * Custom resolver that marks all peerDependencies as externals.
 */
const resolver = new plugin_1.Resolver({
    async resolve({ dependency, options, specifier }) {
        if (WEBPACK_IMPORT_REGEX.test(dependency.specifier)) {
            throw new Error(`The import path: ${dependency.specifier} is using webpack specific loader import syntax, which isn't supported by Parcel.`);
        }
        const projectPackageJSON = path_1.default.join(options.projectRoot, 'package.json');
        const { peerDependencies } = await readJSONFile(options.inputFS, projectPackageJSON);
        const resolver = new node_resolver_core_1.default({
            fs: options.inputFS,
            projectRoot: options.projectRoot,
            // Extensions are always required in URL dependencies.
            extensions: dependency.specifierType === 'commonjs' ||
                dependency.specifierType === 'esm'
                ? ['ts', 'tsx', 'js', 'jsx', 'json']
                : [],
            mainFields: ['source', 'browser', 'module', 'main', 'style'],
        });
        const resolved = await resolver.resolve({
            filename: specifier,
            specifierType: dependency.specifierType,
            parent: dependency.resolveFrom,
            env: dependency.env,
            sourcePath: dependency.sourcePath,
        });
        const packageName = specifier.startsWith('@')
            ? specifier.split('/').slice(0, 2).join('/')
            : specifier.split('/')[0];
        const isExcluded = packageName in (peerDependencies || {});
        return Object.assign(Object.assign({}, resolved), { isExcluded });
    },
});
exports.default = resolver;
//# sourceMappingURL=index.js.map