import { createPackage, generateContent } from '../create-package-fixture'
import {
  getPackageStats,
  EntryPointError,
} from '../../packages/package-build-stats'
import path from 'path'
import semver from 'semver'
import Chance from 'chance'
import {
  BuildError,
  InstallError,
  PackageNotFoundError,
} from 'package-build-stats'

jest.mock('shortid', () => {
  return {
    generate: jest.fn().mockImplementation(() => 'test'),
  }
})

const withoutEntryPoint = async (
  additionalFields: Record<string, any> = {},
  contentSize: number = 100
) => {
  const packageRoot = path.resolve(path.join(__dirname, '..', 'staging'))
  const packagePath = path.join(packageRoot, 'without-entry-point')
  let pack = await createPackage(packageRoot, 'without-entry-point', {
    name: 'without-entry-point',
    ...additionalFields,
  })
  await pack.addFile('non-index.js', generateContent(contentSize), false)
  return packagePath
}

const withInvalidSyntax = async (
  additionalFields: Record<string, any> = {},
  contentSize: number = 100
) => {
  const packageRoot = path.resolve(path.join(__dirname, '..', 'staging'))
  const packagePath = path.join(packageRoot, 'with-invalid-syntax')
  let pack = await createPackage(packageRoot, 'with-invalid-syntax', {
    name: 'with-invalid-syntax',
    ...additionalFields,
  })
  await pack.addFile('index.js', `())${generateContent(contentSize)}`, false)
  return packagePath
}

const getError = async (promise: Promise<any>): Promise<any> => {
  try {
    await promise
  } catch (error) {
    return error
  }
}

describe('error tests', () => {
  let chance: Chance.Chance

  beforeAll(() => {
    chance = new Chance()
  })

  it.only('throws if entry point is not defined', async () => {
    const packagePath = await withoutEntryPoint()
    let statsPromise = getPackageStats(packagePath, {
      debug: true,
      client: 'pnpm',
    })
    await expect(statsPromise).rejects.toThrow(EntryPointError)
    const error = await getError(statsPromise)
    expect(error.originalError).toMatchSnapshot()
  })

  describe('throws if package is not available', () => {
    test.each(['npm', 'yarn', 'pnpm'])('throws for %p', async client => {
      let statsPromise = getPackageStats('some-path-not-existing', {
        debug: true,
        // @ts-ignore -- client is a string enum
        client,
      })
      await expect(statsPromise).rejects.toThrow(PackageNotFoundError)
      const error = await getError(statsPromise)
      expect(
        error.originalError
          .split('\n')
          .filter((line: string) => !line.includes('.log'))
          .join('\n')
      ).toMatchSnapshot()
    })
  })

  it.only('throws on invalid syntax', async () => {
    const packagePath = await withInvalidSyntax()
    let statsPromise = getPackageStats(packagePath, {
      debug: true,
      client: 'pnpm',
    })
    await expect(statsPromise).rejects.toThrow(BuildError)
    const error = await getError(statsPromise)
    expect(error.originalError).toMatchSnapshot()
  })
})
