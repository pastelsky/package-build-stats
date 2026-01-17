import ms from 'ms'
import debug from 'debug'

// debug depends on ms, creating a nested dependency tree
const log = debug('app')

export function parseTime(timeString) {
  return ms(timeString)
}

export function logMessage(message) {
  log(message)
  return `Logged: ${message}`
}

export function formatDuration(milliseconds) {
  return ms(milliseconds, { long: true })
}
