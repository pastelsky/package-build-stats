const path = require('path')
const UglifyJS = require("uglify-es")

/**
 * A fork of `webpack-bundle-size-analyzer`.
 * https://github.com/robertknight/webpack-bundle-size-analyzer
 */

function modulePath(identifier) {
    // the format of module paths is
    //   '(<loader expression>!)?/path/to/module.js'
    let loaderRegex = /.*!/;
    return identifier.replace(loaderRegex, '');
}

function getByteLen(normal_val) {
    // Force string type
    normal_val = String(normal_val);

    var byteLen = 0;
    for (var i = 0; i < normal_val.length; i++) {
        var c = normal_val.charCodeAt(i);
        byteLen += c < (1 << 7) ? 1 :
            c < (1 << 11) ? 2 :
                c < (1 << 16) ? 3 :
                    c < (1 << 21) ? 4 :
                        c < (1 << 26) ? 5 :
                            c < (1 << 31) ? 6 : Number.NaN;
    }
    return byteLen;
}

function bundleSizeTree(stats) {
    let statsTree = {
        packageName: '<root>',
        sources: [],
        children: []
    }

    if (stats.name) {
        statsTree.bundleName = stats.name;
    }

    if(!stats.modules)
        return []

    // extract source path for each module
    let modules = stats.modules.map(mod => {
        return {
            orig: mod,
            path: modulePath(mod.identifier),
            sources: [mod.source],
            source: mod.source,
        };
    });

    modules.sort((a, b) => {
        if (a === b) {
            return 0;
        } else {
            return a < b ? -1 : 1;
        }
    });

    modules.forEach(mod => {
        let packages = mod.path.split(new RegExp('\\' + path.sep + 'node_modules\\' + path.sep));
        if (packages.length > 1) {
            let lastSegment = packages.pop()
            let lastPackageName = ''
            if (lastSegment[0] === ('@')) {
                // package is a scoped package
                let offset = lastSegment.indexOf(path.sep) + 1
                lastPackageName = lastSegment.slice(0, offset + lastSegment.slice(offset).indexOf(path.sep))
            } else {
                lastPackageName = lastSegment.slice(0, lastSegment.indexOf(path.sep))
            }
            packages.push(lastPackageName)
        }
        packages.shift()

        let parent = statsTree
        parent.sources.push(mod.source)
        packages.forEach(pkg => {
            let existing = parent.children.filter(child => child.packageName === pkg);
            if (existing.length > 0) {
                existing[0].sources.push(mod.source)
                parent = existing[0]
            } else {
                let newChild = {
                    packageName: pkg,
                    sources: [mod.source],
                    children: []
                };
                parent.children.push(newChild)
                parent = newChild
            }
        })
    })

    const results = statsTree.children.map(treeItem => {
        const sourcesFiltered  = treeItem.sources.filter(source => !!source)

        const uglifiedSource = UglifyJS.minify(sourcesFiltered, {
            mangle: false,
            compress: {
                arrows           : false,
                booleans         : false,
                collapse_vars    : false,
                comparisons      : false,
                conditionals     : false,
                dead_code        : true,
                drop_console     : false,
                drop_debugger    : false,
                ecma             : 5,
                evaluate         : false,
                expression       : false,
                global_defs      : {},
                hoist_funs       : false,
                hoist_vars       : false,
                ie8              : false,
                if_return        : false,
                inline           : true,
                join_vars        : false,
                keep_fargs       : true,
                keep_fnames      : true,
                keep_infinity    : true,
                loops            : false,
                negate_iife      : false,
                passes           : 1,
                properties       : false,
                pure_getters     : "strict",
                pure_funcs       : null,
                reduce_vars      : false,
                sequences        : false,
                side_effects     : false,
                switches         : false,
                top_retain       : null,
                toplevel         : false,
                typeofs          : false,
                unsafe           : false,
                unsafe_arrows    : false,
                unsafe_comps     : false,
                unsafe_math      : false,
                unused           : true,
                warnings         : false
            },
        })

        if(uglifiedSource.error) {
            console.log(treeItem.packageName)
            throw new Error('Uglifying failed' + uglifiedSource.error)
        }

        return {
            name: treeItem.packageName,
            approximateSize: getByteLen(uglifiedSource.code)
        }
    })

    return results
}

module.exports = bundleSizeTree