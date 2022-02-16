'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.isReactNativePackage =
  exports.cleanWebpackPath =
  exports.updateProjectPeerDependencies =
  exports.getPackageJSONFromPath =
  exports.getPackageFromWebpackPath =
  exports.parsePackageNameFromPath =
  exports.parsePackageString =
  exports.getExternals =
  exports.exec =
    void 0
const child_process_1 = __importDefault(require('child_process'))
const path_1 = __importDefault(require('path'))
const builtin_modules_1 = __importDefault(require('builtin-modules'))
const fs_1 = __importDefault(require('fs'))
const os_1 = __importDefault(require('os'))
const memoizee_1 = __importDefault(require('memoizee'))
const homeDirectory = os_1.default.homedir()
function exec(command, options, timeout) {
  let timerId
  return new Promise((resolve, reject) => {
    const child = child_process_1.default.exec(
      command,
      options,
      (error, stdout, stderr) => {
        if (error) {
          reject(stderr)
        } else {
          resolve(stdout)
        }
        if (timerId) {
          clearTimeout(timerId)
        }
      }
    )
    if (timeout) {
      timerId = setTimeout(() => {
        process.kill(child.pid)
        reject(
          `Execution of ${command.substring(
            0,
            40
          )}... cancelled as it exceeded a timeout of ${timeout} ms`
        )
      }, timeout)
    }
  })
}
exports.exec = exec
/**
 * Gets external peerDeps that shouldn't be a
 * part of the build in a regex format -
 * /(^dep-a$|^dep-a\/|^dep-b$|^dep-b\/)\//
 */
function getExternals(packageName, installPath) {
  const packageJSONPath = path_1.default.join(
    installPath,
    'node_modules',
    packageName,
    'package.json'
  )
  const packageJSON = require(packageJSONPath)
  const dependencies = Object.keys(packageJSON.dependencies || {})
  const peerDependencies = Object.keys(packageJSON.peerDependencies || {})
  // All packages with name same as a built-in node module, but
  // haven't explicitly been added as an npm dependency or aren't the package itself
  // are externals
  const builtInExternals = builtin_modules_1.default.filter(
    mod => !dependencies.includes(mod) && mod !== packageName
  )
  return {
    externalPackages: peerDependencies,
    externalBuiltIns: builtInExternals,
  }
}
exports.getExternals = getExternals
function expandTilde(pathString) {
  return homeDirectory
    ? pathString.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathString
}
function isLocalPackageString(packageString) {
  const packageJsonPath = path_1.default.resolve(packageString, 'package.json')
  try {
    if (fs_1.default.existsSync(packageJsonPath)) {
      return true
    }
  } catch (err) {
    return false
  }
}
function isScopedPackageString(packageString) {
  return packageString.startsWith('@')
}
function parseLocalPackageString(packageString) {
  const fullPath = path_1.default.resolve(packageString, 'package.json')
  const packageJSON = require(fullPath)
  return {
    name: packageJSON.name,
    version: packageJSON.version,
    scoped: packageJSON.name.startsWith('@'),
    normalPath: packageString,
    isLocal: true,
  }
}
function parseScopedPackageString(packageString) {
  const lastAtIndex = packageString.lastIndexOf('@')
  return {
    name:
      lastAtIndex === 0
        ? packageString
        : packageString.substring(0, lastAtIndex),
    version:
      lastAtIndex === 0 ? null : packageString.substring(lastAtIndex + 1),
    scoped: true,
  }
}
function parseUnscopedPackageString(packageString) {
  const lastAtIndex = packageString.lastIndexOf('@')
  return {
    name:
      lastAtIndex === -1
        ? packageString
        : packageString.substring(0, lastAtIndex),
    version:
      lastAtIndex === -1 ? null : packageString.substring(lastAtIndex + 1),
    scoped: false,
  }
}
function parsePackageString(packageString) {
  const normalPackageString = expandTilde(packageString)
  if (isLocalPackageString(normalPackageString)) {
    return parseLocalPackageString(normalPackageString)
  } else if (isScopedPackageString(normalPackageString)) {
    return parseScopedPackageString(normalPackageString)
  } else {
    return parseUnscopedPackageString(normalPackageString)
  }
}
exports.parsePackageString = parsePackageString
// Works only when the `path` begins with the package name
const parsePackageNameFromPath = path => {
  const fragments = path.split('/')
  if (path.startsWith('@')) {
    return [fragments[0], fragments[1]].join('/')
  } else {
    return fragments[0]
  }
}
exports.parsePackageNameFromPath = parsePackageNameFromPath
/**
 *
 */
function getPackageFromWebpackPath(filePath) {
  let filePathReal = filePath.includes('!')
    ? filePath.split('!')[filePath.split('!').length - 1]
    : filePath
  let lastNodeModulesIndex =
    filePathReal.lastIndexOf('node_modules') + 'node_modules'.length + 1
  return {
    name: (0, exports.parsePackageNameFromPath)(
      filePathReal.substring(lastNodeModulesIndex)
    ),
    cleanPath: filePathReal,
  }
}
exports.getPackageFromWebpackPath = getPackageFromWebpackPath
exports.getPackageJSONFromPath = (0, memoizee_1.default)(
  filePath => {
    const { cleanPath, name } = getPackageFromWebpackPath(filePath)
    const packageRoot = cleanPath.substring(
      0,
      cleanPath.lastIndexOf(name) + name.length
    )
    try {
      const packageJSON = require(path_1.default.join(
        packageRoot,
        'package.json'
      ))
      return packageJSON
    } catch (err) {
      return null
    }
  },
  { max: 1000 }
)
async function updateProjectPeerDependencies(projectPath, peerDependencies) {
  const packageJSONPath = path_1.default.join(projectPath, 'package.json')
  const packageJSONContents = JSON.parse(
    await fs_1.default.promises.readFile(packageJSONPath, 'utf-8')
  )
  const updatedJSON = Object.assign(Object.assign({}, packageJSONContents), {
    peerDependencies: Object.assign(
      Object.assign({}, packageJSONContents.peerDependencies),
      peerDependencies
    ),
  })
  await fs_1.default.promises.writeFile(
    packageJSONPath,
    JSON.stringify(updatedJSON),
    'utf-8'
  )
}
exports.updateProjectPeerDependencies = updateProjectPeerDependencies
/**
 * eg.
 * loader!/private/tmp/tmp-build/packages/build-gulp-ORQ/node_modules/.pnpm/is-data@0.1.4/node_modules/is-data/index.ts =>  is-data/index.ts
 */
function cleanWebpackPath(filePath, installPath) {
  // Webpack paths are of the form `loader!path`
  let filePathReal = filePath.includes('!')
    ? filePath.split('!')[filePath.split('!').length - 1]
    : filePath
  let fragments = filePathReal
    .substring(filePathReal.indexOf(installPath) + installPath.length + 1)
    .split(path_1.default.sep)
  // let currentFragment = fragments[0]
  // while (['node_modules', '.pnpm'].includes(currentFragment)) {
  //   currentFragment = fragments.shift() || ''
  // }
  return filePath //fragments.join(path.sep)
}
exports.cleanWebpackPath = cleanWebpackPath
function isReactNativePackage(packageName) {
  return packageName.startsWith('react-native')
}
exports.isReactNativePackage = isReactNativePackage
