// Large bundle fixture - substantial amount of code
export class Calculator {
  constructor() {
    this.history = []
    this.precision = 2
  }

  add(a, b) {
    const result = a + b
    this.history.push({ operation: 'add', a, b, result })
    return this.round(result)
  }

  subtract(a, b) {
    const result = a - b
    this.history.push({ operation: 'subtract', a, b, result })
    return this.round(result)
  }

  multiply(a, b) {
    const result = a * b
    this.history.push({ operation: 'multiply', a, b, result })
    return this.round(result)
  }

  divide(a, b) {
    if (b === 0) {
      throw new Error('Division by zero')
    }
    const result = a / b
    this.history.push({ operation: 'divide', a, b, result })
    return this.round(result)
  }

  power(base, exponent) {
    const result = Math.pow(base, exponent)
    this.history.push({ operation: 'power', base, exponent, result })
    return this.round(result)
  }

  sqrt(value) {
    if (value < 0) {
      throw new Error('Cannot calculate square root of negative number')
    }
    const result = Math.sqrt(value)
    this.history.push({ operation: 'sqrt', value, result })
    return this.round(result)
  }

  round(value) {
    return Number(value.toFixed(this.precision))
  }

  setPrecision(precision) {
    this.precision = precision
  }

  getHistory() {
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }

  getLastResult() {
    if (this.history.length === 0) {
      return null
    }
    return this.history[this.history.length - 1].result
  }
}

export function createCalculator() {
  return new Calculator()
}

export function validateNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

export function formatNumber(value, decimals = 2) {
  if (!validateNumber(value)) {
    return 'Invalid number'
  }
  return value.toFixed(decimals)
}
