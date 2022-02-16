"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("@parcel/plugin");
const utils_1 = require("@parcel/utils");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const utils_2 = require("./utils");
let graphCache = [];
let debug = true;
/**
 * Gets information about a package from its parent (sourcePath)
 */
const getRequireeDetails = async (specifier, sourcePath) => {
    const specifierName = (0, utils_2.getDependencyFromSpecifier)(specifier);
    const { packageRoot, packageName } = (0, utils_2.getPackageRoot)(sourcePath, specifier);
    const { dependencies, peerDependencies } = await (0, utils_2.getPackageJSONDetails)(packageRoot);
    return {
        packageRoot,
        packageName,
        versionRangeDependency: dependencies[specifierName],
        versionRangePeerDependency: peerDependencies[specifierName],
    };
};
/**
 * Gets information about the required dependency, resolved from the main asset path
 */
const resolveRequiredDependency = async (specifier, mainAssetPath) => {
    try {
        // TODO: See if this can be replaced with enhanced-resolve or something better
        let resolved = require.resolve(specifier, {
            paths: [mainAssetPath],
        });
        const { packageName, packageRoot } = (0, utils_2.getPackageRoot)(resolved, specifier);
        const { version } = await (0, utils_2.getPackageJSONDetails)(packageRoot);
        return {
            packageRoot,
            packageName,
            resolvedVersion: version,
        };
    }
    catch (err) {
        console.warn('Unable to resolve required dependency  ' +
            specifier +
            ' at ' +
            mainAssetPath);
        return null;
    }
};
const calculateComposition = (assets) => {
    const contributionMap = {};
    assets.forEach(asset => {
        if (!asset.details)
            return;
        const assetKey = asset.details.packageName + '_$_$_' + asset.details.resolvedVersion;
        if (contributionMap[assetKey]) {
            contributionMap[assetKey] = Object.assign(Object.assign({}, contributionMap[assetKey]), { assets: [...contributionMap[assetKey].assets, asset.filePath], totalSize: contributionMap[assetKey].totalSize + asset.size });
        }
        else {
            contributionMap[assetKey] = {
                assets: [asset.filePath],
                totalSize: asset.size,
                packageName: asset.details.packageName,
                versionRanges: asset.details.versionRanges,
                requiredBy: asset.details.requiredBy,
                resolvedVersion: asset.details.resolvedVersion,
            };
        }
    });
    return Object.values(contributionMap).map(composition => ({
        size: composition.totalSize,
        name: composition.packageName,
        versionRanges: composition.versionRanges,
        resolvedVersion: composition.resolvedVersion,
        requiredBy: composition.requiredBy,
    }));
};
const formatAssets = (bundle) => {
    const assetsAre = [];
    bundle.traverseAssets(asset => {
        assetsAre.push({
            type: asset.type,
            meta: asset.meta,
            stats: asset.stats,
            filePath: asset.filePath,
            dependencies: asset.getDependencies().map(dependency => {
                return {
                    sourcePath: dependency.sourcePath,
                    specifier: dependency.specifier,
                    resolveFrom: dependency.resolveFrom,
                    sourceAssetType: dependency.sourceAssetType,
                };
            }),
        });
    });
    return assetsAre;
};
exports.default = new plugin_1.Reporter({
    async report({ event, options }) {
        if (event.type !== 'buildSuccess') {
            return;
        }
        const projectPackageJSON = path_1.default.join(options.projectRoot, 'package.json');
        const { peerDependencies, dependencies } = await (0, utils_2.readJSONFileFromFS)(options.inputFS, projectPackageJSON);
        const dependenciesTyped = dependencies;
        const mainPackageDetails = {
            packageName: Object.keys(dependenciesTyped)[0],
            packageVersion: Object.values(dependenciesTyped)[0],
        };
        const allBundles = event.bundleGraph.getBundles();
        graphCache = [];
        const bundlesFormatted = allBundles.map(bundle => ({
            bundleFilePath: bundle.filePath,
            bundleName: bundle.name,
            assets: formatAssets(bundle),
        }));
        let bundleGraphCache = [];
        const getDependencyDetails = async (dependency, assetFilePath) => {
            if ((0, utils_2.isPackageSpecifier)(dependency.specifier) &&
                (0, utils_2.isSpecifierNotIgnored)(dependency.specifier, peerDependencies) &&
                dependency.sourcePath) {
                const requiredDependencyDetails = await resolveRequiredDependency(dependency.specifier, assetFilePath);
                if (!requiredDependencyDetails)
                    return null;
                return Object.assign(Object.assign({ assetFilePath, specifier: dependency.specifier }, requiredDependencyDetails), { requiredBy: await getRequireeDetails(dependency.specifier, dependency.sourcePath) });
            }
            else {
                return null;
            }
        };
        for (const bundle of bundlesFormatted) {
            bundleGraphCache = [];
            const promises = bundle.assets.map(asset => asset.dependencies.map(async (dependency) => {
                const dependencyDetails = await getDependencyDetails(dependency, asset.filePath);
                if (dependencyDetails) {
                    bundleGraphCache.push(dependencyDetails);
                }
            }));
            await Promise.all(promises);
        }
        await promises_1.default.writeFile('./build-results.json', JSON.stringify(bundlesFormatted, null, 2), 'utf8');
        await promises_1.default.writeFile('./graph-cache.json', JSON.stringify(bundleGraphCache, null, 2), 'utf8');
        console.log('written to disk');
        await Promise.all(allBundles.map(bundle => getBundleNode(bundle, bundleGraphCache, options, mainPackageDetails)));
    },
});
function checkForNodePolyfill(assetFilePath) {
    const fallback = {
        packageName: '(unknown)',
        resolvedVersion: '0.0.0',
        versionRanges: [],
        requiredBy: [],
    };
    const parts = assetFilePath.split('/');
    if (!parts.includes('node_modules'))
        return fallback;
    const packageName = parts[parts.indexOf('node_modules') + 1];
    // See: https://parceljs.org/features/node-emulation/#polyfilling-%26-excluding-builtin-node-modules
    switch (packageName) {
        case 'buffer':
        case 'assert':
        case 'crypto':
        case 'domain':
        case 'events':
        case 'http':
        case 'https':
        case 'os':
        case 'path':
        case 'zlib':
            return {
                packageName: `(${packageName}-polyfill)`,
                resolvedVersion: '0.0.0',
                versionRanges: [],
                requiredBy: [],
            };
        default:
            return fallback;
    }
}
async function getBundleNode(bundle, graphCache, options, mainPackageDetails) {
    let buildMetrics = await (0, utils_1.generateBuildMetrics)([bundle], options.outputFS, options.projectRoot);
    const augmentAsset = (asset) => {
        const assetRoot = (0, utils_2.getPackageRoot)(asset.filePath, '');
        const matchedGraphCache = graphCache
            .filter(graphCacheItem => graphCacheItem.requiredBy.versionRangeDependency ||
            graphCacheItem.requiredBy.versionRangePeerDependency)
            .filter(cache => cache.packageRoot === assetRoot.packageRoot);
        if (!matchedGraphCache.length) {
            if (['regenerator-runtime', '@swc/helpers'].includes(assetRoot.packageName)) {
                // These are assets injected by Parcel-SWC transformer, ignore them
                return null;
            }
            console.warn("Couldn't find graph cache for asset: ", asset.filePath);
            return Object.assign(Object.assign({}, asset), { details: checkForNodePolyfill(asset.filePath) });
        }
        const getVersionRange = (details) => {
            const range = details.requiredBy.versionRangeDependency ||
                details.requiredBy.versionRangePeerDependency;
            if (!range) {
                console.log('WASTE details ', details);
                throw new Error(`Couldn't find version range for ${details.assetFilePath}`);
            }
            return range;
        };
        const getPackageName = (details) => details.requiredBy.packageName;
        const getResolvedVersion = (details) => details.resolvedVersion;
        const uniqueVersionRanges = [
            ...new Set(matchedGraphCache.map(getVersionRange)),
        ];
        const uniqueRequiredBy = [...new Set(matchedGraphCache.map(getPackageName))];
        const uniqueResolvedVersions = [
            ...new Set(matchedGraphCache.map(getResolvedVersion)),
        ];
        if (uniqueResolvedVersions.length > 1) {
            throw new Error(`Multiple resolved versions for ${asset.filePath}`);
        }
        return Object.assign(Object.assign({}, asset), { details: {
                packageName: matchedGraphCache[0].packageName,
                resolvedVersion: matchedGraphCache[0].resolvedVersion,
                versionRanges: uniqueVersionRanges,
                requiredBy: uniqueRequiredBy,
            } });
    };
    const assets = buildMetrics.bundles[0].assets
        // Sourcemaps sometimes contain unmapped paths
        // .filter(asset => !!asset.filePath)
        // Filter out the setup file (projectRoot/index.js), because we wrote it to disk already
        .filter(asset => {
        const assetRoot = (0, utils_2.getPackageRoot)(asset.filePath, '');
        // We do a ends with instead of equality because the resolved asset root (e.g /private/tmp/... ) might have
        // extra prefixes over the project root (e.g /tmp/... )
        return !assetRoot.packageRoot.endsWith(options.projectRoot);
    })
        .map(asset => augmentAsset(asset))
        .filter(utils_2.notEmpty);
    await promises_1.default.writeFile(`./build-metrics-assets-raw.json`, JSON.stringify(buildMetrics.bundles[0].assets, null, 2), 'utf8');
    await promises_1.default.writeFile(`./build-metrics-smap-${bundle.name}.json`, JSON.stringify(assets, null, 2), 'utf8');
    const constituents = calculateComposition(assets);
    console.log('constituents are yo', constituents.sort((a, b) => b.size - a.size));
    await promises_1.default.writeFile('./composition.json', JSON.stringify(constituents, null, 2), 'utf8');
    return;
}
//# sourceMappingURL=index.js.map