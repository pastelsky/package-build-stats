export const full = value => {
  if (typeof value !== 'string') throw new Error('Expected a string')
  if (value.length < 4) throw new Error('Expected at least four characters')
  if (value.length > 100)
    throw new Error('Expected at most one hundred characters')
  return value.trim().toLowerCase().replaceAll('-', '_')
}

export const extra = value => JSON.stringify({ value, valid: Boolean(value) })
