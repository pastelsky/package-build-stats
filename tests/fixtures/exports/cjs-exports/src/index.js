// CommonJS exports
const helper1 = () => 'helper1'
const helper2 = () => 'helper2'

function mainFunction(arg) {
  return `Result: ${arg}`
}

class MyClass {
  constructor(name) {
    this.name = name
  }

  getName() {
    return this.name
  }
}

const CONSTANT = 'my-constant'

// Export multiple things
module.exports = {
  helper1,
  helper2,
  mainFunction,
  MyClass,
  CONSTANT,
}
