const {
  getExportsDetails,
  getAllExports,
} = require('../src/utils/exports.utils')
const path = require('path')

describe('individual exports', () => {
  test('variable exports', () => {
    const exportsA = getExportsDetails(`export let name1, name2;`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1', 'name2'],
    })

    const exportsB = getExportsDetails(`export let name1 = 4`)
    expect(exportsB).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1'],
    })

    const exportsC = getExportsDetails(`export var name1 = 4`)
    expect(exportsC).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1'],
    })

    const exportsD = getExportsDetails(`export const name1 = 4`)
    expect(exportsD).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1'],
    })
  })

  test('function exports', () => {
    const exportsA = getExportsDetails(`export function functionName(){}`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['functionName'],
    })
  })

  test('class exports', () => {
    const exportsA = getExportsDetails(`export class ClassName {}`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['ClassName'],
    })
  })
})

describe('list exports', () => {
  test('', () => {
    const exportsA = getExportsDetails(`export { name1, name2, nameN };`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1', 'name2', 'nameN'],
    })
  })
})

describe('renaming exports', () => {
  test('', () => {
    const exportsA = getExportsDetails(
      `export { variable1 as name1, variable2 as name2, nameN }`
    )
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1', 'name2', 'nameN'],
    })
  })
})

describe('exporting destructured assignments', () => {
  test('object', () => {
    const exportsA = getExportsDetails(
      `export const { name1, name2: bar } = o;`
    )
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1', 'bar'],
    })
  })

  test('array', () => {
    const exportsA = getExportsDetails(
      `export const [name1, name2, ...rest ] = o;`
    )
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1', 'name2', 'rest'],
    })
  })

  test('complex destructuring & assignments', () => {
    const exportsA = getExportsDetails(
      ` export const [arr1,arr2, [nestedArr], {obj1, ...objRest}, assignedArr=3, ...restArr] = o`
    )
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: [
        'arr1',
        'arr2',
        'nestedArr',
        'obj1',
        'objRest',
        'assignedArr',
        'restArr',
      ],
    })
  })
})

describe('default exports', () => {
  test('basic', () => {
    const exportsA = getExportsDetails(`export default 7;`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['default'],
    })
  })

  test('function', () => {
    const exportsA = getExportsDetails(`export default function () { };`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['default'],
    })
  })

  test('function*', () => {
    const exportsA = getExportsDetails(`export default function* () { };`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['default'],
    })
  })

  test('class', () => {
    const exportsA = getExportsDetails(`export default class{ };`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['default'],
    })
  })

  test('named', () => {
    const exportsA = getExportsDetails(`export { name1 as default };`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['default'],
    })
  })

  test('reexport', () => {
    const exportsA = getExportsDetails(`export { default } from './some-file'`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['default'],
    })
  })
})

describe('aggregating modules', () => {
  test('*', () => {
    const exportsA = getExportsDetails(`export * from './some-file';`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: ['./some-file'],
      exports: [],
    })
  })

  test('named', () => {
    const exportsA = getExportsDetails(
      `export { name1, name2, nameN } from './some-file';`
    )
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['name1', 'name2', 'nameN'],
    })
  })

  test('named re-export', () => {
    const exportsA = getExportsDetails(`export * as new from './some-file';`)
    expect(exportsA).toStrictEqual({
      exportAllLocations: [],
      exports: ['new'],
    })
  })
})

describe('getAllExports', () => {
  it('resolved all kinds of paths properly and gives the right results', async () => {
    const exports = await getAllExports(
      'some-package',
      path.join(__dirname, '../fixtures'),
      'resolve-test'
    )
    expect(exports).toStrictEqual({
      default:
        'node_modules/resolve-test/nested-folder/another-nested-folder/node_modules/dependency/dependency-entry-1.js',
      AClass: 'node_modules/resolve-test/another-file-1.js',
      Foo: 'node_modules/resolve-test/entry-1.js',
      aVariable: 'node_modules/resolve-test/another-file-1.js',
      bFunction: 'node_modules/resolve-test/another-file-2.js',
      dependencyEntry:
        'node_modules/resolve-test/nested-folder/another-nested-folder/node_modules/dependency/dependency-entry-1.js',
    })
  })
})
