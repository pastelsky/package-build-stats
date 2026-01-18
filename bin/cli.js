#!/usr/bin/env node
import { register } from 'esbuild-register/dist/node.js'

register({
  target: 'es2020',
})

await import('./cli.ts')
