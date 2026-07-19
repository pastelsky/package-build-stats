import { InstallError } from '../../src/errors/CustomError.js'

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
})
