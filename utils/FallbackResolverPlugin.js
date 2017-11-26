//module.exports = class MyResolverPlugin {
//  constructor(options) {
//    this.fallbackModulePath = options.fallback
//    this.resolveModule = this.resolveModule.bind(this)
//    this.resolve = this.resolve.bind(this)
//    this.apply = this.apply.bind(this)
//  }
//
//  resolve(module, callback) {
//    console.log('resolving')
//    const version = require("webpack/package.json").version
//    const major = version.split(".").shift()
//
//    if (major === "1") {
//      return this.compiler.resolvers.normal.resolve(
//        module.path,
//        module.request,
//        callback
//      )
//    }
//
//    if (major === "2" || major === "3") {
//      console.log('resolving webpack 2 / 3', module.request)
//      return this.compiler.resolvers.normal.resolve(
//        module.context || {},
//        module.path,
//        module.request,
//        callback
//      )
//    }
//
//    throw new Error("Unsupported Webpack version: " + version);
//  }
//
//  resolveModule(module, next) {
//    console.log('resolve module', module.request, module.descriptionFileData.name)
//
//    console.log('fallback module name', this.fallbackModulePath)
//
//    const fallbackModule = Object.assign({}, module, {
//      request: this.fallbackModulePath.replace('/index.js', ''),
//    })
//
//    this.resolve(fallbackModule, () => {
//      return next(null, fallbackModule)
//    })
//  }
//
//  apply(compiler) {
//    this.compiler = compiler;
//    compiler.plugin("after-resolvers", (compiler) => {
//      compiler.resolvers.normal.plugin("module", this.resolveModule)
//    })
//  }
//}


function NpmInstallPlugin(options) {
  this.options = options
}

NpmInstallPlugin.prototype.apply = function(compiler) {
  this.compiler = compiler;

  // Recursively install missing dependencies so primary build doesn't fail
  //compiler.plugin("watch-run", this.preCompile.bind(this));


  compiler.plugin("after-resolvers", function(compiler) {
    // Install project dependencies on demand
    compiler.resolvers.normal.plugin("module", this.resolveModule.bind(this));
  }.bind(this))
};

NpmInstallPlugin.prototype.resolve = function(resolver, result, callback) {
  var version = require("webpack/package.json").version;
  var major = version.split(".").shift();
  if (major === "1") {
    return this.compiler.resolvers[resolver].resolve(
      result.path,
      this.options.fallback,
      callback
    );
  }

  if (major === "2" || major === "3") {
    console.log('webpack 3', result)
    return this.compiler.resolvers[resolver].resolve(
      result.context || {},
      result.path,
      this.options.fallback,
      callback
    );
  }

  throw new Error("Unsupported Webpack version: " + version);
}

NpmInstallPlugin.prototype.resolveModule = function(result, next) {
  this.resolve('normal', result, function(err, filepath) {

    if (err) {
      console.log('errooo', err)
    }

    return next();
  }.bind(this));
};

module.exports = NpmInstallPlugin;