const parser = require('@babel/parser')
const { default: traverse } = require('@babel/traverse')
const path = require('path')
const fs = require('then-fs')
const enhancedResolve = require('enhanced-resolve')
const makeWebpackConfig = require('../webpack.config')

/**
 * Parses code to return all named (and default exports)
 * as well as `export * from` locations
 */
function getExportsDetails(code) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    allowUndeclaredExports: true,
    plugins: ['exportDefaultFrom'],
  })

  const exportAllLocations = []
  let exportsList = []

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const { specifiers, declaration } = path.node
      exportsList = exportsList.concat(
        specifiers.map(specifier => specifier.exported.name)
      )

      if (declaration) {
        if (declaration.declarations) {
          const moreExports = declaration.declarations.map(dec => {
            if (dec.id.type === 'ObjectPattern') {
              exportsList = exportsList.concat(
                dec.id.properties.map(property => property.value.name)
              )
            } else if (dec.id.type === 'Identifier') {
              exportsList.push(dec.id.name)
            }
          })
        } else if (declaration.id) {
          exportsList.push(declaration.id.name)
        }
      }
    },

    ExportDefaultDeclaration() {
      exportsList.push('default')
    },

    ExportAllDeclaration(path) {
      exportAllLocations.push(path.node.source.value)
    },
  })

  return {
    exportAllLocations,
    exports: exportsList,
  }
}

const webpackConfig = makeWebpackConfig({ entryPoint: '', externals: [] })
const resolver = enhancedResolve.create({
  extensions: webpackConfig.resolve.extensions,
  modules: webpackConfig.resolve.modules,
  mainFields: webpackConfig.resolve.mainFields,
})

const resolve = async (context, path) =>
  new Promise((resolve, reject) => {
    resolver(context, path, (err, result) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })

/**
 * Recursively get all exports starting
 * from a given path
 */
async function getAllExports(context, lookupPath) {
  const getAllExportsRecursive = async (ctx, lookPath) => {
    const resolvedPath = await resolve(ctx, lookPath)

    const resolvedExports = {}
    const code = await fs.readFile(resolvedPath, 'utf8')
    const { exports, exportAllLocations } = getExportsDetails(code)

    console.log('CONTEXT: ', context, 'resolvedPath', resolvedPath)
    exports.forEach(exp => {
      const relativePath = resolvedPath.substring(
        resolvedPath.indexOf(context) + context.length + 1
      )
      resolvedExports[exp] = relativePath
    })

    const promises = exportAllLocations.map(async location => {
      const exports = await getAllExportsRecursive(
        path.dirname(resolvedPath),
        location
      )
      Object.keys(exports).forEach(expKey => {
        resolvedExports[expKey] = exports[expKey]
      })
    })

    await Promise.all(promises)
    return resolvedExports
  }

  const allExports = await getAllExportsRecursive(context, lookupPath)
  return allExports
}

module.exports = { getExportsDetails, getAllExports }
