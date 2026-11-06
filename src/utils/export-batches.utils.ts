import fs from 'node:fs/promises'
import path from 'node:path'
import { throwIfAborted } from './common.utils.js'

const MAX_EXPORTS = 100
const MAX_SOURCE_BYTES = 48 * 1024 * 1024

// Estimate repeated code-generation work, not a hard bound on native memory.
export async function* exportBatches(
  exports: string[],
  exportMap: Record<string, string>,
  installPath: string,
  signal?: AbortSignal,
) {
  const sourceSizes = new Map<string, number>()
  let batch: string[] = []
  let bytes = 0

  for (const name of exports) {
    throwIfAborted(signal)
    const sourcePath = path.resolve(installPath, exportMap[name])
    let size = sourceSizes.get(sourcePath)
    if (size === undefined) {
      try {
        // Read metadata incrementally instead of queuing another filesystem scan.
        // oxlint-disable-next-line no-await-in-loop
        const stat = await fs.stat(sourcePath)
        size = stat.isFile() ? stat.size : MAX_SOURCE_BYTES
      } catch {
        // Let compilation classify missing sources; isolate unknown costs.
        size = MAX_SOURCE_BYTES
      }
      sourceSizes.set(sourcePath, size)
    }
    throwIfAborted(signal)
    if (
      batch.length > 0 &&
      (batch.length >= MAX_EXPORTS || bytes + size > MAX_SOURCE_BYTES)
    ) {
      yield batch
      batch = []
      bytes = 0
    }
    batch.push(name)
    // A shared source is generated separately for each export entry point.
    bytes += size
  }

  if (batch.length > 0) yield batch
}
