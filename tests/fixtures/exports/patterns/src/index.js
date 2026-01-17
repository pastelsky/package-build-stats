// Array pattern exports
const [first, second] = [1, 2]
export { first, second }

// Object pattern exports
const { prop1, prop2 } = { prop1: 'a', prop2: 'b' }
export { prop1, prop2 }

// Default export
export default function patterns() {
  return 'patterns'
}
