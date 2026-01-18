import mitt from 'mitt'
import type { Emitter, EventType } from 'mitt'
import { parsePackageString } from './common.utils.js'
import { performance } from 'perf_hooks'
import _ from 'lodash'
import createDebug from 'debug'

const debug = createDebug('bp-telemetry')

type Events = Record<EventType, unknown>
const emitter: Emitter<Events> = (
  mitt as unknown as <T extends Record<EventType, unknown>>() => Emitter<T>
)<Events>()
export { emitter }

emitter.on('*', (type: EventType, data: unknown) => {
  debug('Telementry Event: %s  %o', type, data)
})

function errorToObject(error: any) {
  if (!error) return
  if (error && typeof error === 'object') {
    const errorObject = {}

    Object.getOwnPropertyNames(error).forEach(key => {
      // @ts-ignore
      errorObject[key] =
        typeof error[key] === 'object'
          ? errorToObject(error[key])
          : String(error[key]).substring(0, 40)
    })
    return errorObject
  }
  return { error }
}

export default class Telemetry {
  static installPackage(
    packageString: string,
    isSuccessful: boolean,
    startTime: number,
    options: any,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_INSTALL', {
      package: parsePackageString(packageString),
      isSuccessful,
      duration: performance.now() - startTime,
      options,
      error: errorToObject(error),
    })
  }

  static getPackageJSONDetails(
    packageName: string,
    isSuccessful: boolean,
    startTime: number,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_JSON_DETAILS', {
      package: { name: packageName },
      isSuccessful,
      duration: performance.now() - startTime,
      error: errorToObject(error),
    })
  }

  static buildPackage(
    packageName: string,
    isSuccessful: boolean,
    startTime: number,
    options: any,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_BUILD', {
      package: { name: packageName },
      isSuccessful,
      duration: performance.now() - startTime,
      options: _.omit(options, 'customImports'),
      error: errorToObject(error),
    })
  }

  static compilePackage(
    packageName: string,
    isSuccessful: boolean,
    startTime: number,
    options: any,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_COMPILE', {
      packageName,
      isSuccessful,
      duration: performance.now() - startTime,
      options,
      error: errorToObject(error),
    })
  }

  static packageStats(
    packageString: string,
    isSuccessful: boolean,
    startTime: number,
    options: any,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_STATS', {
      package: parsePackageString(packageString),
      isSuccessful,
      duration: performance.now() - startTime,
      options,
      error: errorToObject(error),
    })
  }

  static parseWebpackStats(
    packageName: string,
    isSuccessful: boolean,
    startTime: number,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_PARSE_WEBPACK_STATS', {
      package: { name: packageName },
      isSuccessful,
      duration: performance.now() - startTime,
      error: errorToObject(error),
    })
  }

  static dependencySizes(
    packageName: string,
    startTime: number,
    isSuccessful: boolean,
    options: any,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_DEPENDENCY_SIZES', {
      package: { name: packageName },
      duration: performance.now() - startTime,
      isSuccessful,
      options,
      error: errorToObject(error),
    })
  }

  static assetsGZIPParseTime(packageName: string, startTime: number) {
    emitter.emit('TASK_PACKAGE_ASSETS_GZIP_PARSE_TIME', {
      package: { name: packageName },
      duration: performance.now() - startTime,
    })
  }

  static walkPackageExportsTree(
    packageString: string,
    startTime: number,
    isSuccessful: boolean,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_EXPORTS_TREEWALK', {
      package: parsePackageString(packageString),
      isSuccessful,
      duration: performance.now() - startTime,
      error: errorToObject(error),
    })
  }

  static packageExports(
    packageString: string,
    startTime: number,
    isSuccessful: boolean,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_EXPORTS', {
      package: parsePackageString(packageString),
      isSuccessful,
      duration: performance.now() - startTime,
      error: errorToObject(error),
    })
  }

  static packageExportsSizes(
    packageString: string,
    startTime: number,
    isSuccessful: boolean,
    options: any,
    error: any = null,
  ) {
    emitter.emit('TASK_PACKAGE_EXPORTS_SIZES', {
      package: parsePackageString(packageString),
      duration: performance.now() - startTime,
      isSuccessful,
      error: errorToObject(error),
      options,
    })
  }
}
