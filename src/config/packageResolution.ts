import { ResolverFactory } from 'oxc-resolver'
import {
  browserImportConditions,
  packageExtensions,
  packageMainFields,
} from './packageConditions.js'

export { browserImportConditions, packageExtensions, packageMainFields }

const resolver = new ResolverFactory({
  extensions: packageExtensions,
  mainFields: packageMainFields,
  conditionNames: [...browserImportConditions],
  aliasFields: ['browser'],
  symlinks: false,
})

export function resolvePackageModule(context: string, request: string) {
  return resolver.sync(context, request).path
}
