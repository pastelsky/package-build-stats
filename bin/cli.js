require('esbuild-register/dist/node').register({
  target: 'es2020',
})

require('./cli.ts')
