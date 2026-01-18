// Re-export everything from internal dependency (simulates Vue's export * from '@vue/runtime-dom')
export * from '../deps/internal-dep'

// Also export a local function (simulates Vue's compile export)
export function localExport() {
  return 'local'
}
