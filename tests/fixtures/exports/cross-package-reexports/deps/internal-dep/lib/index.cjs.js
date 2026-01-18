// CJS build (no ESM syntax - this is what the resolver should NOT pick)
'use strict'

exports.createApp = function() {
  return { mount: function() {} }
}

exports.ref = function(value) {
  return { value: value }
}

exports.reactive = function(obj) {
  return obj
}

exports.computed = function(getter) {
  return { value: getter() }
}

exports.watch = function(source, cb) {
  return function() {}
}

exports.VERSION = '1.0.0'
