import fs from 'fs/promises'
import mkdirp from 'mkdirp'
// @ts-ignore
import PackageJson from '@npmcli/package-json'
import path from 'path'

function makeid(length: number) {
  let result = ''
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

async function createPackageFile(
  packagePath: string,
  relativePath: string,
  content: string,
  isMain: boolean = false
) {
  const fullPath = path.join(packagePath, relativePath)
  await fs.writeFile(fullPath, content, 'utf8')
  if (isMain) {
    const pkgJson = await PackageJson.load(packagePath)
    pkgJson.update({
      main: relativePath,
    })
    await pkgJson.save()
  }
}

type PackageDescriptor = {
  name: string
  version: string
  path: string
}

async function addDependency(
  packagePath: string,
  name: string,
  linkImport: boolean = true
) {
  const dependencyPath = path.join(packagePath, 'node_modules')
  const pkgJson = await PackageJson.load(packagePath)
  if (linkImport) {
    const pkg = require(path.join(packagePath, 'package.json'))
    console.log('link import')
    const mainFile = pkg.main || pkg.module
    const mainFilePath = path.join(packagePath, mainFile)

    const mainFileContents = await fs.readFile(path.join(packagePath, mainFile))
    await fs.writeFile(
      mainFilePath,
      `import '${name}';\n ${mainFileContents}`,
      'utf8'
    )
  }
  const result = await createPackage(dependencyPath, name, { name: name })
  pkgJson.update({
    dependencies: {
      [name]: `*`,
    },
  })
  await pkgJson.save()
  return result
}

export async function createPackage(
  where: string,
  name: string,
  packageJSON: Record<string, any>
) {
  const packagePath = path.resolve(path.join(where, name))
  await mkdirp(packagePath)

  await fs.writeFile(
    path.join(packagePath, 'package.json'),
    JSON.stringify(packageJSON, null, 2)
  )

  return {
    get: () => ({
      name: packageJSON.name,
      version: packageJSON.version,
      path: path,
    }),
    addDependency: (name: string, linkImport: boolean = true) =>
      addDependency(packagePath, name, linkImport),
    addFile: (relativePath: string, content: string, isMain: boolean = false) =>
      createPackageFile(packagePath, relativePath, content, isMain),
  }
}

export function generateContent(sizeBytes: number) {
  const content = makeid(sizeBytes)
  return `
    console.log('${makeid(Math.max(0, sizeBytes - 15))}')
  `
}
