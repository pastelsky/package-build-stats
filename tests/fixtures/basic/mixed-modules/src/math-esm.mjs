/**
 * ESM math utilities
 */

export function divide(a, b) {
  if (b === 0) throw new Error('Division by zero')
  return a / b
}

export function add(a, b) {
  return a + b
}
