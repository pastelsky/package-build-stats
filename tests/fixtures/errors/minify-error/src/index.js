// This code is designed to pass rspack bundling but potentially cause minification errors
// by using extremely complex patterns that stress the minifier

// Generate an extremely large string literal that might cause buffer overflow
const hugeString = 'x'.repeat(1000000)

// Create deeply nested function calls
function nest(n) {
  return n > 0 ? () => nest(n - 1) : () => 42
}

// Extremely complex object with circular-like references
const obj1 = { name: 'obj1', ref: null }
const obj2 = { name: 'obj2', ref: obj1 }
obj1.ref = obj2

// Very long single expression
const result =
  ((((((((((1 + 2) * 3 - 4) / 5 + 6) * 7 - 8) / 9 + 10) * 11 - 12) / 13 + 14) *
    15 -
    16) /
    17 +
    18) *
    19 -
    20) /
    21 +
  22

// Export everything to ensure it's processed
export default {
  hugeString,
  nested: nest(100),
  obj1,
  obj2,
  result,
  // Massive computed property names
  computed: {
    ['prop_' + 'a'.repeat(1000)]: 'value',
  },
}
