import { performance } from 'perf_hooks'
import webpack, { Entry, Stats, WebpackError } from 'webpack'
import makeWebpackConfig from '../config/makeWebpackConfig'
import memfs from 'memfs'
import Telemetry from './telemetry.utils'
import { Externals } from '../common.types'
import workerpool from 'workerpool'
import path from 'path'

export const filepath = path.resolve(__filename)

export type CompilePackageArgs = {
  name: string
  externals: Externals
  entry: Entry
  debug?: boolean
  minifier: 'terser' | 'esbuild'
}

type CompilePackageReturn = {
  stats: Stats | undefined
  error: WebpackError
  fileSystem: memfs.IFs
}

async function compilePackage({
  name,
  entry,
  externals,
  debug,
  minifier,
}: CompilePackageArgs) {
  console.log('starting paras are ', arguments)
  const startTime = performance.now()
  const compiler = webpack(
    makeWebpackConfig({
      packageName: name,
      entry,
      externals,
      debug,
      minifier,
    })
  )

  compiler.outputFileSystem = memfs.fs as any
  compiler.intermediateFileSystem = memfs.fs as any

  return new Promise<CompilePackageReturn>(resolve => {
    compiler.run((err, stats) => {
      const error = err as unknown as WebpackError // Webpack types incorrect
      // stats object can be empty if there are build errors
      resolve({ stats, error, fileSystem: memfs.fs })

      if (error) {
        console.error(error)
        Telemetry.compilePackage(name, false, startTime, { minifier }, error)
      } else {
        Telemetry.compilePackage(name, true, startTime, { minifier })
      }
    })
  })
}

workerpool.worker({
  compilePackage,
})
