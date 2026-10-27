export * from './index.js'
export default 'not re-exported by star'
export const named = 'leaf'
const value = 42
export {
  value as enum,
  value as function,
  value as null,
  value as 'dash-name',
  value as '../outside',
  value as '__proto__',
  value as runtime,
}
