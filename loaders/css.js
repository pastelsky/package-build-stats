module.exports = function (content) {
  if (this.cacheable) this.cacheable()
  return `module.exports = ${JSON.stringify(content)}`
}
