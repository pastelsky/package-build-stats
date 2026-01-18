// Re-export from individual files (simulates lodash-es pattern)
export { default as add } from './add.js'
export { default as subtract } from './subtract.js'
export { default as multiply } from './multiply.js'

// Also export a local function
export function localHelper() {
  return 'local'
}
