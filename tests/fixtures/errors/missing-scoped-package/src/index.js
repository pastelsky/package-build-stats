// This file imports a missing scoped package to trigger scoped package parsing
const missing = require('@babel/runtime/helpers/typeof')
module.exports = { missing }
