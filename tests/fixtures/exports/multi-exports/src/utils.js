// Utility functions
export function formatString(str) {
  return str.toUpperCase()
}

export function parseNumber(num) {
  return parseInt(num, 10)
}

export function validateEmail(email) {
  return email.includes('@')
}

export const UTILS_VERSION = '1.0.0'
