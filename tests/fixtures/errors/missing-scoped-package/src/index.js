// This file imports a missing scoped package to trigger scoped package parsing
const missing = require('@missing-scope-xyz/nonexistent-package/helpers/typeof')
module.exports = { missing }
