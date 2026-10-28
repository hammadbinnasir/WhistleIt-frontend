import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  getAuthUserId,
  hasAuthSession,
  saveAuthToken,
} from './session'

describe('auth session', () => {
  beforeEach(() => {
    clearAuthSession()
  })

  it('stores a token for the current browser session by default', () => {
    expect(saveAuthToken({ access_token: 'session-token' })).toBe('session-token')

    expect(sessionStorage.getItem('authToken')).toBe('session-token')
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(getAuthToken()).toBe('session-token')
    expect(hasAuthSession()).toBe(true)
  })

  it('stores the logged-in user name with the session', () => {
    saveAuthToken({
      access_token: 'session-token',
      user: { first_name: 'Sara', last_name: 'Khan' },
    })

    expect(getAuthUser()).toEqual({ fullName: 'Sara Khan' })
  })

  it('stores the user ID for user-scoped API requests', () => {
    saveAuthToken({
      access_token: 'session-token',
      user: { id: 42, full_name: 'Sara Khan' },
    })

    expect(getAuthUserId()).toBe('42')
    expect(getAuthUser()).toEqual({ id: '42', fullName: 'Sara Khan' })
  })

  it('reads the user name from a JWT when the login response omits user data', () => {
    const payload = btoa(JSON.stringify({ sub: 'user-42', name: 'Sara Khan' }))
    saveAuthToken({ token: `header.${payload}.signature` })

    expect(getAuthUser()).toEqual({ id: 'user-42', fullName: 'Sara Khan' })
  })

  it('stores a remembered token persistently and replaces any previous token', () => {
    sessionStorage.setItem('authToken', 'old-token')

    saveAuthToken({ data: { token: 'remembered-token' } }, true)

    expect(localStorage.getItem('authToken')).toBe('remembered-token')
    expect(sessionStorage.getItem('authToken')).toBeNull()
  })

  it('does not create a session when the response has no token', () => {
    expect(saveAuthToken({ message: 'Login successful' })).toBeNull()
    expect(hasAuthSession()).toBe(false)
  })

  it('clears the token from both storage locations', () => {
    localStorage.setItem('authToken', 'persistent-token')
    sessionStorage.setItem('authToken', 'session-token')

    clearAuthSession()

    expect(getAuthToken()).toBeNull()
    expect(getAuthUser()).toBeNull()
    expect(hasAuthSession()).toBe(false)
  })
})
