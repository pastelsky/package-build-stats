import fs from 'node:fs/promises'
import { getPackageEntryPoints as enumeratePackageEntryPoints } from 'pkg-entry-points'
import { throwIfAborted } from './common.utils.js'

function withAbortSignal(signal: AbortSignal) {
  return new Proxy(fs, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver)
      if (typeof member !== 'function') {
        return member
      }

      return async (...args: unknown[]) => {
        throwIfAborted(signal)
        const result = await Reflect.apply(member, target, args)
        throwIfAborted(signal)
        return result
      }
    },
  }) as typeof fs
}

function isBundlableTarget(target: string) {
  const pathname = target.split(/[?#]/, 1)[0]
  return (
    !pathname.endsWith('.d.ts') &&
    !pathname.endsWith('.d.mts') &&
    !pathname.endsWith('.d.cts') &&
    !pathname.endsWith('.json')
  )
}

function toEntryPoint(packageName: string, subpath: string) {
  return subpath === '.'
    ? packageName
    : `${packageName}/${subpath.replace(/^\.\//, '')}`
}

export async function getEntryPointsFromPackage(
  packageName: string,
  packagePath: string,
  signal?: AbortSignal,
) {
  throwIfAborted(signal)
  const entryPoints = await enumeratePackageEntryPoints(
    packagePath,
    signal ? withAbortSignal(signal) : fs,
  )
  throwIfAborted(signal)

  return Object.entries(entryPoints)
    .filter(([, mappings]) =>
      mappings.some(([, target]) => isBundlableTarget(target)),
    )
    .map(([subpath]) => toEntryPoint(packageName, subpath))
    .sort((left, right) => {
      if (left === packageName) return -1
      if (right === packageName) return 1
      return left.localeCompare(right)
    })
}
