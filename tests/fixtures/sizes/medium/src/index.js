// Medium bundle fixture - moderate amount of code
export function calculate(a, b, operation) {
  switch (operation) {
    case 'add':
      return a + b
    case 'subtract':
      return a - b
    case 'multiply':
      return a * b
    case 'divide':
      return b !== 0 ? a / b : null
    default:
      return null
  }
}

export function formatResult(value) {
  if (value === null) {
    return 'Invalid operation'
  }
  return `Result: ${value}`
}

export function validateInput(input) {
  return typeof input === 'number' && !isNaN(input)
}









