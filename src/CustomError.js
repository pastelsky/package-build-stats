/**
 * Wraps the original error with a identifiable
 * name.
 */
module.exports = function CustomError(name, originalError, extra) {
  Error.captureStackTrace(this, this.constructor)
  this.name = name
  this.originalError = originalError
  this.extra = extra
}
