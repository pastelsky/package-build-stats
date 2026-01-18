// ESM entry point with actual exports (simulates @vue/runtime-dom ESM build)

export function createApp() {
  return { mount: () => {} }
}

export function ref(value) {
  return { value }
}

export function reactive(obj) {
  return obj
}

export function computed(getter) {
  return { value: getter() }
}

export function watch(source, cb) {
  return () => {}
}

export const VERSION = '1.0.0'
