import fs from 'node:fs'
import path from 'node:path'
import v8 from 'node:v8'
import server from 'server'
const { get } = server.router
const { json, status } = server.reply

import {
  getPackageStats,
  getPackageExportSizes,
  getAllPackageExports,
} from './build/index.js'

const PORT = 3000
const activeRequests = new Map()
let nextRequestId = 0

const formatMiB = bytes => Number((bytes / 1024 / 1024).toFixed(1))
const getMemorySnapshot = () => {
  const usage = process.memoryUsage()
  const heap = v8.getHeapStatistics()

  return {
    rssMiB: formatMiB(usage.rss),
    heapUsedMiB: formatMiB(usage.heapUsed),
    heapTotalMiB: formatMiB(usage.heapTotal),
    externalMiB: formatMiB(usage.external),
    arrayBuffersMiB: formatMiB(usage.arrayBuffers),
    mallocedMiB: formatMiB(heap.malloced_memory),
    peakMallocedMiB: formatMiB(heap.peak_malloced_memory),
    nativeContextCount: heap.number_of_native_contexts,
    detachedContextCount: heap.number_of_detached_contexts,
    activeRequests: activeRequests.size,
  }
}

const logMemory = (label, extra = {}) => {
  console.log(
    '[MEMORY]',
    JSON.stringify({
      ts: new Date().toISOString(),
      pid: process.pid,
      label,
      ...getMemorySnapshot(),
      ...extra,
    }),
  )
}

const getOldestRequest = () =>
  [...activeRequests.values()].sort((a, b) => a.startedAt - b.startedAt)[0]

const withMemoryLogging = (label, handler) => async ctx => {
  const requestId = ++nextRequestId
  const startedAt = Date.now()
  const before = getMemorySnapshot()

  activeRequests.set(requestId, {
    label,
    path: ctx.url,
    startedAt,
    query: ctx.query,
  })

  try {
    return await handler(ctx)
  } finally {
    activeRequests.delete(requestId)

    const after = getMemorySnapshot()
    const durationMs = Date.now() - startedAt
    const rssDeltaMiB = Number((after.rssMiB - before.rssMiB).toFixed(1))
    const heapDeltaMiB = Number(
      (after.heapUsedMiB - before.heapUsedMiB).toFixed(1),
    )

    if (durationMs >= 1500 || Math.abs(rssDeltaMiB) >= 40) {
      logMemory('request-finished', {
        requestId,
        route: label,
        path: ctx.url,
        package: ctx.query?.p ?? null,
        durationMs,
        rssDeltaMiB,
        heapDeltaMiB,
      })
    }
  }
}

const heapSnapshotDir = path.join(process.cwd(), 'reports', 'heap-debug')
fs.mkdirSync(heapSnapshotDir, { recursive: true })

setInterval(() => {
  const oldestRequest = getOldestRequest()
  logMemory('interval', {
    oldestRequestAgeMs: oldestRequest
      ? Date.now() - oldestRequest.startedAt
      : 0,
    oldestRequestPath: oldestRequest?.path ?? null,
    oldestRequestLabel: oldestRequest?.label ?? null,
  })
}, 30000).unref()

console.log(`Starting at port ${PORT}`)
logMemory('startup')

server({ port: PORT }, [
  get(
    '/size',
    withMemoryLogging('/size', async ctx => {
      const packageString = decodeURIComponent(ctx.query.p)

      try {
        const result = await getPackageStats(packageString, {
          ...ctx.query,
        })
        return json(result)
      } catch (err) {
        console.log(err)
        return status(500).send({
          statusCode: 500,
          body: JSON.stringify(err),
        })
      }
    }),
  ),
  get(
    '/export-sizes',
    withMemoryLogging('/export-sizes', async ctx => {
      const packageString = decodeURIComponent(ctx.query.p)

      try {
        const result = await getPackageExportSizes(packageString, {
          debug: !!ctx.query.debug,
          minifier: ctx.query.minifier,
        })
        return json(result)
      } catch (err) {
        console.log(err)
        return status(500).send({
          statusCode: 500,
          body: JSON.stringify(err),
        })
      }
    }),
  ),
  get(
    '/exports',
    withMemoryLogging('/exports', async ctx => {
      const packageString = decodeURIComponent(ctx.query.p)

      try {
        const result = await getAllPackageExports(packageString, {
          debug: !!ctx.query.debug,
        })
        return json(result)
      } catch (err) {
        console.log(err)
        return status(500).send({
          statusCode: 500,
          body: JSON.stringify(err),
        })
      }
    }),
  ),
  get('/__debug/memory', async () => json(getMemorySnapshot())),
  get('/__debug/heapdump', async () => {
    const filePath = path.join(
      heapSnapshotDir,
      `heap-${Date.now()}-${process.pid}.heapsnapshot`,
    )

    if (typeof global.gc === 'function') {
      global.gc()
    }

    const snapshotPath = v8.writeHeapSnapshot(filePath)
    logMemory('heapdump', { snapshotPath })

    return json({
      snapshotPath,
      ...getMemorySnapshot(),
    })
  }),
])
