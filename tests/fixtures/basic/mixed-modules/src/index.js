/**
 * Mixed modules fixture - Main entry (CommonJS)
 */

const { multiply } = require('./math-cjs')
const { divide } = require('./math-esm.mjs')

function calculate(a, b) {
  return {
    product: multiply(a, b),
    quotient: divide(a, b),
  }
}

module.exports = { calculate }
