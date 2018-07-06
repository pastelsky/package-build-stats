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
        const uglifiedSource = UglifyJS.minify(treeItem.sources, {
            mangle: false,
            compress: false
        })

        return {
            name: treeItem.packageName,
            approximateSize: getByteLen(uglifiedSource.code)
        }
    })

    return results
}

module.exports = bundleSizeTree