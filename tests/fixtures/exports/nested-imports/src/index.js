// Import from nested modules
import { utilA, utilB } from './utils/index.js'
import { helperA, helperB } from './helpers/index.js'

// Export individual utilities
export { utilA, utilB }
export { helperA, helperB }

// Export combined functionality
export function combined() {
  return {
    a: utilA(),
    b: utilB(),
    c: helperA(),
    d: helperB(),
  }
}
