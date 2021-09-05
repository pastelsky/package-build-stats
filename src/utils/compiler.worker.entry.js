console.log('process.env.NODE_ENV', process.env.NODE_ENV)

if (process.env.NODE_ENV === 'development') {
  require('ts-node').register({
    transpileOnly: true,
  })
  require(__dirname + '/compiler.worker.ts')
} else {
  require(__dirname + '/compiler.worker.js')
}
