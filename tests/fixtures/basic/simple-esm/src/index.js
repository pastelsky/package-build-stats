/**
 * Simple ESM test fixture
 * Tests basic ESM export and bundling
 */

export function hello(name = 'World') {
  return `Hello, ${name}!`
}

export function add(a, b) {
  return a + b
}

export const VERSION = '1.0.0'
