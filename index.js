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
  getPackageEntryPoints,
} from './build/index.js'

const PORT = Number(process.env.PORT ?? 3000)

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(
    `PORT must be an integer between 1 and 65535; received ${process.env.PORT}`,
  )
}

const activeRequests = new Map()
let nextRequestId = 0
let isShuttingDown = false

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
    isShuttingDown,
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

const packageRoute = (route, handler) =>
  get(
    route,
    withMemoryLogging(route, async ctx => {
      try {
        return json(await handler(decodeURIComponent(ctx.query.p), ctx.query))
      } catch (error) {
        console.error(error)
        return status(500).send({
          statusCode: 500,
          body: JSON.stringify(error),
        })
      }
    }),
  )

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

const application = await server({ port: PORT }, [
  packageRoute('/size', (packageString, query) =>
    getPackageStats(packageString, { ...query }),
  ),
  packageRoute('/export-sizes', (packageString, query) =>
    getPackageExportSizes(packageString, {
      debug: !!query.debug,
      minifier: query.minifier,
    }),
  ),
  packageRoute('/exports', (packageString, query) =>
    getAllPackageExports(packageString, { debug: !!query.debug }),
  ),
  packageRoute('/entry-points', (packageString, query) =>
    getPackageEntryPoints(packageString, { debug: !!query.debug }),
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

const shutdown = async signal => {
  if (isShuttingDown) return
  isShuttingDown = true
  logMemory('shutdown-start', { signal })

  const forceShutdownTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out')
    process.exit(1)
  }, 10000)
  forceShutdownTimer.unref()

  try {
    await application.close()
    logMemory('shutdown-complete', { signal })
  } catch (error) {
    console.error('Graceful shutdown failed:', error)
    process.exitCode = 1
  } finally {
    clearTimeout(forceShutdownTimer)
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown(signal)
  })
}
