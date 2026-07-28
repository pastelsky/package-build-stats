import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { rspack } from '@rspack/core'
import type { Stats } from '@rspack/core'

import makeRspackConfig from '../../src/config/makeRspackConfig.js'

const temporaryDirectories: string[] = []

async function compile(minify: boolean) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'package-build-stats-oxc-'),
  )
  temporaryDirectories.push(directory)

  const entry = path.join(directory, 'index.js')
  const outputPath = path.join(directory, 'dist')
  await fs.writeFile(
    entry,
    `
      // This comment and the descriptive names should be removed.
      function addTheseNumbersTogether(firstNumber, secondNumber) {
        return firstNumber + secondNumber
      }
      console.log(addTheseNumbersTogether(1, 2))
    `,
  )

  const compiler = rspack(
    makeRspackConfig({
      packageName: 'fixture',
      entry,
      externals: {
        externalPackages: [],
        externalBuiltIns: [],
      },
      minify,
      outputPath,
    }),
  )

  const stats = await new Promise<Stats>((resolve, reject) => {
    compiler.run((error, result) => {
      compiler.close(closeError => {
        if (closeError) {
          reject(closeError)
        } else if (error) {
          reject(error)
        } else if (!result) {
          reject(new Error('Rspack returned no stats'))
        } else {
          resolve(result)
        }
      })
    })
  })

  expect(stats.hasErrors()).toBe(false)
  return fs.readFile(path.join(outputPath, 'main.bundle.js'), 'utf8')
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => fs.rm(directory, { recursive: true, force: true })),
  )
})

describe('OxcJsMinimizerRspackPlugin', () => {
  test('minifies JavaScript assets when minification is enabled', async () => {
    const output = await compile(true)

    expect(output).not.toContain('This comment')
    expect(output).not.toContain('addTheseNumbersTogether')
  })

  test('leaves JavaScript assets readable when minification is disabled', async () => {
    const output = await compile(false)

    expect(output).toContain('addTheseNumbersTogether')
  })
})
