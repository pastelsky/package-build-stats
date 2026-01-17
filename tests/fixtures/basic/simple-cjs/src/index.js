/**
 * Simple CommonJS test fixture
 * Tests basic CommonJS exports and bundling
 */

function hello(name) {
  name = name || 'World'
  return 'Hello, ' + name + '!'
}

function add(a, b) {
  return a + b
}

const VERSION = '1.0.0'

module.exports = {
  hello: hello,
  add: add,
  VERSION: VERSION,
}
