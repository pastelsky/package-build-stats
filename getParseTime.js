const fs = require('fs')
const baseScript = fs.readFileSync('./fixtures/base.js', 'utf8')

const { VMScript } = require('vm2')
const now = require('performance-now')
const stats = require("stats-lite")
const debug = require("debug")("bp:worker")

function getParseTime(currentScript, trialCount = 5) {
  let baseVMScript, currentVMScript

  const trials = 5
  let baseCounter = 0
  let baseResults = []

  let currentCounter = 0
  let currentResults = []

  while (baseCounter++ < trials) {
    baseVMScript = new VMScript(`${Math.random()}; ${baseScript}`)
    const start = now()
    baseVMScript.compile()
    const end = now()
    baseResults.push(end - start)
  }

  while (currentCounter++ < trials) {
    currentVMScript = new VMScript(`${Math.random()}; ${currentScript}`)
    const start = now()
    currentVMScript.compile()
    const end = now()
    currentResults.push(end - start)
  }

  const baseMedian = stats.median(baseResults)
  const currentMedian = stats.median(currentResults)

  debug('base parse time: %d | script parse time: %d', baseMedian, currentMedian)
  debug('base deviation: %d | script deviation: %d', stats.stdev(baseResults), stats.stdev(currentResults))

  debug('parse time ratio', currentMedian / baseMedian)

  return {
    baseParseTime: baseMedian,
    scriptParseTime: currentMedian,
  }
}

module.exports = getParseTime

