import { InstallError } from '../../src/errors/CustomError.js'
import { ProcessExecutionError } from '../../src/utils/common.utils.js'

describe('CustomError', () => {
  test('preserves the cause', () => {
    const cause = new Error('npm failed')
    const error = new InstallError(cause, { client: 'npm' })

    expect(error).toMatchObject({
      name: 'InstallError',
      cause,
      originalError: cause,
      extra: { client: 'npm' },
    })
    expect(error.toJSON()).toMatchObject({ name: 'InstallError' })
  })

  test('keeps process failures string-compatible when serialized', () => {
    const cause = new ProcessExecutionError('npm failed', '', 'npm failed', 1)
    const error = new InstallError(cause)

    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      name: 'InstallError',
      originalError: 'npm failed',
    })
  })
})
