import { describe, expect, it } from 'vitest'
import {
  CLIBuildError,
  EntryPointError,
  UnsupportedPackageError,
  screenPackageManifest,
} from '../../src/preflight.js'

describe('screenPackageManifest', () => {
  it('allows valid frontend and legacy packages', () => {
    expect(() =>
      screenPackageManifest(
        {
          name: 'react',
          version: '19.2.0',
          exports: { '.': './index.js', './jsx-runtime': './jsx-runtime.js' },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).not.toThrow()

    // Legacy package without exports/main may still have implicit index.js
    expect(() =>
      screenPackageManifest(
        {
          name: 'legacy-with-bin',
          version: '1.0.0',
          bin: './cli.js',
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).not.toThrow()

    // Conditions-object exports (no leading dots) applies to root "."
    expect(() =>
      screenPackageManifest(
        {
          name: 'conditions-exports',
          version: '1.0.0',
          exports: { import: './esm.js', default: './cjs.js' },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).not.toThrow()
  })

  it('rejects packages whose os or cpu constraints exclude the target host', () => {
    expect(() =>
      screenPackageManifest(
        { name: 'mac-only', os: ['darwin'] },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(UnsupportedPackageError)

    expect(() =>
      screenPackageManifest(
        { name: 'no-linux', os: ['!linux'] },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(UnsupportedPackageError)

    expect(() =>
      screenPackageManifest(
        { name: 'arm-only', cpu: ['arm64'] },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(UnsupportedPackageError)

    expect(() =>
      screenPackageManifest(
        { name: 'linux-ok', os: ['darwin', 'linux'], cpu: ['!arm64'] },
        { platform: 'linux', arch: 'x64' },
      ),
    ).not.toThrow()
  })

  it('rejects subpath-map exports that omit root "."', () => {
    expect(() =>
      screenPackageManifest(
        {
          name: 'subpath-only-lib',
          exports: {
            './package.json': './package.json',
            './utils': './utils.js',
          },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(EntryPointError)

    expect(() =>
      screenPackageManifest(
        {
          name: 'subpath-cli',
          bin: { cli: './bin.js' },
          exports: { './package.json': './package.json' },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(CLIBuildError)

    // Allowed when explicitly requesting an exported subpath
    expect(() =>
      screenPackageManifest(
        {
          name: 'subpath-only-lib',
          exports: { './utils': './utils.js' },
        },
        { platform: 'linux', arch: 'x64', entryPoint: './utils' },
      ),
    ).not.toThrow()
  })

  it('rejects null or types-only exports targets', () => {
    expect(() =>
      screenPackageManifest(
        {
          name: 'types-only-root',
          exports: { '.': { types: './index.d.ts' } },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(EntryPointError)

    expect(() =>
      screenPackageManifest(
        {
          name: 'types-only-conditions',
          exports: { types: './index.d.ts' },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(EntryPointError)

    expect(() =>
      screenPackageManifest(
        {
          name: 'null-root',
          exports: { '.': null },
        },
        { platform: 'linux', arch: 'x64' },
      ),
    ).toThrow(EntryPointError)

    expect(() =>
      screenPackageManifest(
        {
          name: 'types-only-subpath',
          exports: { './types': { types: './types.d.ts' } },
        },
        { platform: 'linux', arch: 'x64', entryPoint: './types' },
      ),
    ).toThrow(EntryPointError)
  })
})
