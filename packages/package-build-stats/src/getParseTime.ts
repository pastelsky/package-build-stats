import fs from 'fs'
import path from 'path'

import { VMScript } from 'vm2'
import now from 'performance-now'
import stats from 'stats-lite'
const debug = require('debug')('bp:worker')

function getParseTime(currentScript: string, trialCount = 5) {
  let baseVMScript, currentVMScript

  let baseCounter = 0
  let baseResults = []

  let currentCounter = 0
  let currentResults = []

  const baseScript = fs.readFileSync(
    path.join(__dirname, 'fixed', 'parseReference.js'),
    'utf8'
  )

  try {
    while (baseCounter++ < trialCount) {
      baseVMScript = new VMScript(`${Math.random()}; ${baseScript}`)
      const start = now()
      baseVMScript.compile()
      const end = now()
      baseResults.push(end - start)
    }

    while (currentCounter++ < trialCount) {
      currentVMScript = new VMScript(`${Math.random()}; ${currentScript}`)
      const start = now()
      currentVMScript.compile()
      const end = now()
      currentResults.push(end - start)
    }

    const baseMedian = stats.median(baseResults)
    const currentMedian = stats.median(currentResults)

    debug(
      'base parse time: %d | script parse time: %d',
      baseMedian,
      currentMedian
    )
    debug(
      'base deviation: %d | script deviation: %d',
      stats.stdev(baseResults),
      stats.stdev(currentResults)
    )

    debug('parse time ratio', currentMedian / baseMedian)

    return {
      baseParseTime: baseMedian,
      scriptParseTime: currentMedian,
    }
  } catch (err) {
    console.error('Failed to get parsed times, is this a valid JS file?')
    return {}
  }
}

export default getParseTime
