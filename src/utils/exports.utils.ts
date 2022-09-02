import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import path from 'path'
import { promises as fs } from 'fs'
import enhancedResolve from 'enhanced-resolve'
import makeWebpackConfig from '../config/makeWebpackConfig'
import {
  ArrayPattern,
  AssignmentPattern,
  ObjectPattern,
  RestElement,
} from '@babel/types'
import Telemetry from './telemetry.utils'
import { performance } from 'perf_hooks'

const assertUnreachable = (x?: never): never => {
  throw new Error("Didn't expect to get here")
}

/**
 * Parses code to return all named (and default exports)
 * as well as `export * from` locations
 */
export function getExportsDetails(code: string) {
  const ast = parse(code, {
    sourceType: 'module',
    allowUndeclaredExports: true,
    plugins: ['exportDefaultFrom'],
  })

  const exportAllLocations: string[] = []
  let exportsList: string[] = []

  const processObjectPattern = (
    properties: ObjectPattern['properties'],
    result: string[] = []
  ) => {
    properties.forEach(property => {
      switch (property.type) {
        case 'RestElement':
          if (property.argument.type === 'Identifier') {
            result.push(property.argument.name)
          }
          break
        case 'ObjectProperty':
          if (property.value.type === 'Identifier') {
            result.push(property.value.name)
          }
          break
        // default:
        //   assertUnreachable(property.type)
      }
    })
  }

  const processAssignmentPattern = (
    element: AssignmentPattern,
    result: string[] = []
  ) => {
    switch (element.left.type) {
      case 'Identifier':
        result.push(element.left.name)
        break

      case 'ArrayPattern':
        processArrayPattern(element.left.elements, result)
        break

      case 'ObjectPattern':
        processObjectPattern(element.left.properties, result)
        break

      case 'MemberExpression':
        // unhandled
        break
      // default:
      //   assertUnreachable(element.left.type)
    }
  }

  const processRestElement = (element: RestElement, result: string[] = []) => {
    if (element.argument.type === 'Identifier') {
      result.push(element.argument.name)
    }
  }

  const processArrayPattern = (
    elements: ArrayPattern['elements'],
    result: string[] = []
  ) => {
    elements.forEach(element => {
      if (element) {
        switch (element.type) {
          case 'Identifier':
            result.push(element.name)
            break
          case 'RestElement':
            processRestElement(element, result)
            break
          case 'ArrayPattern':
            processArrayPattern(element.elements, result)
            break

          case 'ObjectPattern':
            processObjectPattern(element.properties, result)
            break

          case 'AssignmentPattern':
            processAssignmentPattern(element, result)
            break

          // default:
          //   assertUnreachable(element.type)
        }
      }
    })
  }

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const { specifiers, declaration } = path.node

      if (declaration) {
        switch (declaration.type) {
          case 'VariableDeclaration':
            declaration.declarations.forEach(dec => {
              switch (dec.id.type) {
                case 'ObjectPattern':
                  processObjectPattern(dec.id.properties, exportsList)
                  break

                case 'ArrayPattern':
                  processArrayPattern(dec.id.elements, exportsList)
                  break
                case 'AssignmentPattern':
                  processAssignmentPattern(dec.id, exportsList)
                  break

                case 'RestElement':
                  processRestElement(dec.id, exportsList)
                  break

                case 'Identifier':
                  exportsList.push(dec.id.name)
                  break

                case 'MemberExpression':
                case 'TSParameterProperty':
                  // unhandled
                  break
                // default:
                //   assertUnreachable(dec.id.type)
              }
            })
            break

          case 'FunctionDeclaration':
          case 'ClassDeclaration':
            if (declaration.id) {
              exportsList.push(declaration.id.name)
            }
            break

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
            break

          // default:
          //   assertUnreachable(declaration.type)
        }
      } else {
        specifiers.forEach(specifier => {
          exportsList.push(
            specifier.exported.type === 'StringLiteral'
              ? specifier.exported.value
              : specifier.exported.name
          )
        })
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

const webpackConfig = makeWebpackConfig({
  packageName: '',
  entry: '',
  externals: { externalPackages: [], externalBuiltIns: [] },
  minifier: 'terser',
})

const resolver = enhancedResolve.create({
  extensions: webpackConfig?.resolve?.extensions,
  modules: webpackConfig?.resolve?.modules,
  // @ts-ignore Error due to unsynced types for enhanced resolve and webpack
  mainFields: webpackConfig?.resolve?.mainFields,
  conditionNames: webpackConfig?.resolve?.conditionNames,
})

const resolve = async (context: string, path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    resolver(context, path, (err: Error, result: string) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })

type ResolvedExports = {
  [key: string]: string
}

/**
 * Recursively get all exports starting
 * from a given path
 */
export async function getAllExports(
  packageString: string,
  context: string,
  lookupPath: string
) {
  const startTime = performance.now()
  const getAllExportsRecursive = async (ctx: string, lookPath: string) => {
    const resolvedPath = await resolve(ctx, lookPath)

    const resolvedExports: ResolvedExports = {}
    const code = await fs.readFile(resolvedPath, 'utf8')
    const { exports, exportAllLocations } = getExportsDetails(code)

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

  try {
    const results = await getAllExportsRecursive(context, lookupPath)
    Telemetry.walkPackageExportsTree(packageString, startTime, true)
    return results
  } catch (err) {
    Telemetry.walkPackageExportsTree(packageString, startTime, false, err)
    throw err
  }
}
