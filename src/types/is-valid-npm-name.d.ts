declare module 'is-valid-npm-name' {
  /**
   * Validates an npm package name according to npm rules
   * @param name The package name to validate
   * @returns true if valid, or an error message string if invalid
   */
  function isValidNPMName(name: string): boolean | string
  export = isValidNPMName
}
