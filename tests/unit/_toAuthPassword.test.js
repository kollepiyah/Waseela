import { describe, it, expect } from 'vitest'
import { toAuthPassword as _toAuthPassword } from '../../app/src/services/authSupabase.js'

describe('_toAuthPassword', () => {
  it('prefixes wsl_auth_ to plain password', () => {
    expect(_toAuthPassword('abc')).toBe('wsl_auth_abc')
  })

  it('handles empty string', () => {
    expect(_toAuthPassword('')).toBe('wsl_auth_')
  })

  it('handles null safely', () => {
    expect(_toAuthPassword(null)).toBe('wsl_auth_')
  })

  it('handles undefined safely', () => {
    expect(_toAuthPassword(undefined)).toBe('wsl_auth_')
  })

  it('preserves special characters', () => {
    expect(_toAuthPassword('p@ssw0rd!')).toBe('wsl_auth_p@ssw0rd!')
  })

  it('coerces non-string input via String()', () => {
    expect(_toAuthPassword(12345)).toBe('wsl_auth_12345')
  })

  it('result is always >= 8 chars (Firebase Auth min 6 requirement)', () => {
    expect(_toAuthPassword('a').length).toBeGreaterThanOrEqual(6)
    expect(_toAuthPassword('').length).toBeGreaterThanOrEqual(6)
  })
})
