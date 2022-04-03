import { createPackage, generateContent } from '../create-package-fixture'
import { getPackageStats } from '../../packages/package-build-stats'
import path from 'path'
import semver from 'semver'
import Chance from 'chance'

const basicPackage = async (
  additionalFields: Record<string, any> = {},
  contentSize: number = 100
) => {
  const packageRoot = path.resolve(path.join(__dirname, '..', 'staging'))
  const packagePath = path.join(packageRoot, 'basic-package')
  let pack = await createPackage(packageRoot, 'basic-package', {
    name: 'basic-package',
    ...additionalFields,
  })
  await pack.addFile('index.js', generateContent(contentSize), true)
  return packagePath
}

const basicPackageWithDeps = async () => {
  const packageRoot = path.resolve(path.join(__dirname, '..', 'staging'))
  const packagePath = path.join(packageRoot, 'basic-package-with-deps')
  let pack = await createPackage(packageRoot, 'basic-package-with-deps', {
    name: 'basic-package-with-deps',
  })
  await pack.addFile('index.js', generateContent(100), true)
  const dependency = await pack.addDependency('dependency')
  await dependency.addFile('index.js', generateContent(100), true)
  return packagePath
}

describe('basic tests', () => {
  let chance: Chance.Chance

  beforeAll(() => {
    chance = new Chance()
  })

  it('contains build version', async () => {
    const packagePath = await basicPackage()
    let stats = await getPackageStats(packagePath, {
      debug: true,
      client: 'pnpm',
    })
    expect(semver.valid(stats.buildVersion)).toBeTruthy()
  })

  describe('emits dependency count', () => {
    it('contains dependency count 0 when not present', async () => {
      const packagePath = await basicPackage()
      let stats = await getPackageStats(packagePath, {
        debug: true,
        client: 'pnpm',
      })
      expect(stats.dependencyCount).toEqual(0)
    })

    it('contains dependency count 0 when not present', async () => {
      const packagePath = await basicPackageWithDeps()
      let stats = await getPackageStats(packagePath, {
        debug: true,
        client: 'pnpm',
      })
      expect(stats.dependencyCount).toEqual(1)
    })
  })

  it('contains right module fields', async () => {
    const hasModule = chance.bool()
    const packagePath = await basicPackage({
      module: 'some/path/module',
      'jsnext:main': 'some/path/jsnext',
      sideEffects: ['some/path/sideEffects'],
      ...(hasModule && {
        type: 'module',
      }),
    })

    let stats = await getPackageStats(packagePath, {
      debug: true,
      client: 'pnpm',
    })

    expect(stats.hasJSModule).toEqual('some/path/module')
    expect(stats.hasJSNext).toEqual('some/path/jsnext')
    expect(stats.hasSideEffects).toEqual(['some/path/sideEffects'])
    expect(stats.isModuleType).toEqual(hasModule)
  })

  it('contains right size fields', async () => {
    const contentSize = chance.integer({ min: 100, max: 1000 })
    const packagePath = await basicPackage({}, contentSize)

    let stats = await getPackageStats(packagePath, {
      debug: true,
      client: 'pnpm',
    })

    const fixedCost = 51

    expect(stats.size).toEqual(contentSize + fixedCost)
    expect(stats.gzip).toBeLessThan(stats.size)
    expect(stats.assets).toHaveLength(1)
    expect(stats.assets[0].name).toBe('index')
    expect(stats.assets[0].size).toBe(contentSize + fixedCost)
    expect(stats.assets[0].gzip).toBe(stats.gzip)
  })

  it('contains right dependency fields', async () => {
    const contentSize = chance.integer({ min: 100, max: 1000 })
    const packagePath = await basicPackage({}, contentSize)

    let stats = await getPackageStats(packagePath, {
      debug: true,
      client: 'pnpm',
    })

    expect(stats.dependencySizes).toBeDefined()

    if (!stats.dependencySizes) {
      throw Error('Expected dependencySizes to be defined')
    }

    const self = stats.dependencySizes.find(
      stat => stat.name === 'basic-package'
    )

    expect(self).toBeDefined()

    if (!self) {
      throw Error('Expected self to be defined')
    }

    const fixedCost = 1
    expect(self.requiredBy).toEqual(['basic-package'])
    expect(self.size).toEqual(contentSize + fixedCost)
    expect(self.versionRanges).toEqual([
      'link:/Users/skanodia/dev/package-build-stats/unit-tests/staging/basic-package',
    ])
  })
})
