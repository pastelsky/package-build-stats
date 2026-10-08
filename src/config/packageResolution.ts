import { ResolverFactory } from 'oxc-resolver'

// Browser ESM conditions shared by bundling and named-export discovery.
export const browserImportConditions = [
  'svelte',
  'webpack',
  'production',
  'browser',
  'import',
  'module',
  'default',
]

export const packageMainFields = ['browser', 'module', 'main', 'style']

export const packageExtensions = [
  '.web.tsx',
  '.web.ts',
  '.tsx',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.web.mjs',
  '.mjs',
  '.web.js',
  '.js',
  '.cjs',
  '.json',
  '.css',
  '.sass',
  '.scss',
  '.less',
  '.svelte',
]

const resolver = new ResolverFactory({
  extensions: packageExtensions,
  mainFields: packageMainFields,
  conditionNames: browserImportConditions,
  aliasFields: ['browser'],
  symlinks: false,
})

export function resolvePackageModule(context: string, request: string) {
  return resolver.sync(context, request).path
}
