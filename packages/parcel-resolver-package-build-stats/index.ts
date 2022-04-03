import { Resolver } from '@parcel/plugin'
import NodeResolver from '@parcel/node-resolver-core'
import path from 'path'
import type { FileSystem } from '@parcel/fs'
// Throw user friendly errors on special webpack loader syntax
// ex. `imports-loader?$=jquery!./example.js`
const WEBPACK_IMPORT_REGEX = /^\w+-loader(?:\?\S*)?!/

const readJSONFile = async (fs: FileSystem, filePath: string) => {
  const fileContents = await fs.readFile(filePath, 'utf8')
  return JSON.parse(fileContents)
}

/**
 * Custom resolver that marks all peerDependencies as externals.
 */
const resolver = new Resolver({
  async resolve({ dependency, options, specifier }) {
    if (WEBPACK_IMPORT_REGEX.test(dependency.specifier)) {
      throw new Error(
        `The import path: ${dependency.specifier} is using webpack specific loader import syntax, which isn't supported by Parcel.`
      )
    }

    const projectPackageJSON = path.join(options.projectRoot, 'package.json')

    const { peerDependencies, ignoredDeps } = await readJSONFile(
      options.inputFS,
      projectPackageJSON
    )

    const resolver = new NodeResolver({
      fs: options.inputFS,
      projectRoot: options.projectRoot,
      // Extensions are always required in URL dependencies.
      extensions:
        dependency.specifierType === 'commonjs' ||
        dependency.specifierType === 'esm'
          ? ['ts', 'tsx', 'js', 'jsx', 'json']
          : [],
      mainFields: ['source', 'browser', 'module', 'main', 'style'],
    })

    const resolved = await resolver.resolve({
      filename: specifier,
      specifierType: dependency.specifierType,
      parent: dependency.resolveFrom,
      env: dependency.env,
      sourcePath: dependency.sourcePath,
    })

    const packageName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0]

    const isExcluded = packageName in (peerDependencies || {})

    const resolvedIs = {
      ...resolved,
      filePath: isExcluded ? require.resolve('./noop.js') : resolved?.filePath,
      // isExcluded,
    }
    return resolvedIs
  },
})

export default resolver
