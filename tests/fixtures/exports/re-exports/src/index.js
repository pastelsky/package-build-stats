// Re-export everything from submodules
export * from './math.js'
export * from './string.js'

// Also export a local function
export function localFunction() {
  return 'local'
}
