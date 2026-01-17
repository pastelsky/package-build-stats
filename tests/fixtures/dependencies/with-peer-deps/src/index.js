import { debounce } from 'lodash-es'

// This package has peer dependencies on React and React-DOM
// but actually uses lodash-es as a regular dependency
export function createDebouncedHandler(fn, delay = 300) {
  return debounce(fn, delay)
}

export function greet(name) {
  return `Hello, ${name}!`
}
