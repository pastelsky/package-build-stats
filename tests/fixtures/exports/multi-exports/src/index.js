// Main entry with multiple named exports
export function mainFunction() {
  return 'main function'
}

export const mainConstant = 'main constant value'

export class MainClass {
  constructor() {
    this.name = 'MainClass'
  }

  greet() {
    return `Hello from ${this.name}`
  }
}

export default {
  mainFunction,
  mainConstant,
  MainClass,
}
