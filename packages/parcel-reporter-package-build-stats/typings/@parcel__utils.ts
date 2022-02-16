declare module '@parcel/utils' {
  import type { FileSystem } from '@parcel/fs'
  import type { FilePath, PackagedBundle } from '@parcel/types'

  type AssetStats = {
    filePath: string
    size: number
    originalSize: number
    time: number
  }

  type BundleStats = {
    filePath: string
    size: number
    time: number
    assets: Array<AssetStats>
  }

  type BuildMetrics = {
    bundles: Array<BundleStats>
  }

  export function generateBuildMetrics(
    bundles: Array<PackagedBundle>,
    fs: FileSystem,
    projectRoot: FilePath
  ): Promise<BuildMetrics>

  export class DefaultMap<K, V> extends Map<K, V> {
    constructor(getDefault: (k: K) => V, entries?: Iterable<[K, V]>)
    get(key: K): V
  }
}
