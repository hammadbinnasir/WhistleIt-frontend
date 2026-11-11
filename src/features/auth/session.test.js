import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAuthSession,
  getAuthToken,
  getRememberToken,
  getAuthUser,
  getAuthUserId,
  hasAuthSession,
  consumeAuthRedirect,
  saveAuthRedirect,
  saveAuthToken,
} from './session'

describe('auth session', () => {
  beforeEach(() => {
    clearAuthSession()
  })

  it('stores the auth token in local storage by default', () => {
    expect(saveAuthToken({ access_token: 'session-token' })).toBe('session-token')

    expect(localStorage.getItem('authToken')).toBe('session-token')
    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(getAuthToken()).toBe('session-token')
    expect(hasAuthSession()).toBe(true)
  })

  it('stores the logged-in user name in local storage', () => {
    saveAuthToken({
      access_token: 'session-token',
      user: { first_name: 'Sara', last_name: 'Khan' },
    })

    expect(getAuthUser()).toEqual({ fullName: 'Sara Khan' })
    expect(localStorage.getItem('authUser')).toContain('Sara Khan')
  })

  it('stores the user ID for user-scoped API requests', () => {
    saveAuthToken({
      access_token: 'session-token',
      user: { id: 42, full_name: 'Sara Khan' },
    })

    expect(getAuthUserId()).toBe('42')
    expect(getAuthUser()).toEqual({ id: '42', fullName: 'Sara Khan' })
    expect(localStorage.getItem('authUserId')).toBe('42')
  })

  it('accepts a remember-token-only login response as an authenticated session', () => {
    expect(saveAuthToken({ userId: '123', rememberToken: 'abc123xyz' })).toBe('abc123xyz')

    expect(sessionStorage.getItem('rememberToken')).toBe('abc123xyz')
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(getRememberToken()).toBe('abc123xyz')
    expect(getAuthUserId()).toBe('123')
    expect(hasAuthSession()).toBe(true)
  })

  it('accepts a nested snake-case remember token response', () => {
    expect(saveAuthToken({ data: { data: { user_id: '123', remember_token: 'abc123xyz' } } })).toBe(
      'abc123xyz',
    )

    expect(sessionStorage.getItem('rememberToken')).toBe('abc123xyz')
    expect(getAuthUserId()).toBe('123')
    expect(hasAuthSession()).toBe(true)
  })

  it('reads the user name from a JWT when the login response omits user data', () => {
    const payload = btoa(JSON.stringify({ sub: 'user-42', name: 'Sara Khan' }))
    saveAuthToken({ token: `header.${payload}.signature` })

    expect(getAuthUser()).toEqual({ id: 'user-42', fullName: 'Sara Khan' })
  })

  it('stores access tokens from nested API responses and normalizes Bearer prefixes', () => {
    expect(saveAuthToken({ data: { data: { accessToken: 'Bearer nested-token' } } })).toBe(
      'nested-token',
    )
    expect(getAuthToken()).toBe('nested-token')
  })

  it('replaces legacy session credentials and persists the new token locally', () => {
    sessionStorage.setItem('authToken', 'old-token')
    sessionStorage.setItem('authUserId', 'old-user')

    saveAuthToken({ data: { token: 'remembered-token' } })

    expect(localStorage.getItem('authToken')).toBe('remembered-token')
    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(sessionStorage.getItem('authUserId')).toBeNull()
  })

  it('does not use legacy session credentials when no local token exists', () => {
    sessionStorage.setItem('authToken', 'legacy-token')
    sessionStorage.setItem('authUserId', 'legacy-user')

    expect(getAuthToken()).toBeNull()
    expect(getAuthUserId()).toBeNull()
    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(sessionStorage.getItem('authUserId')).toBeNull()
  })

  it('keeps remembered credentials available after a reload', () => {
    saveAuthToken({
      access_token: 'remembered-token',
      user: { id: 'user-42', full_name: 'Sara Khan' },
    })
    sessionStorage.clear()

    expect(getAuthToken()).toBe('remembered-token')
    expect(getAuthUserId()).toBe('user-42')
  })

  it('does not create a session when the response has no token', () => {
    expect(saveAuthToken({ message: 'Login successful' })).toBeNull()
    expect(hasAuthSession()).toBe(false)
  })

  it('clears auth values without removing unrelated preferences', () => {
    localStorage.setItem('authToken', 'persistent-token')
    localStorage.setItem('authUserId', 'user-42')
    localStorage.setItem('theme', 'dark')
    sessionStorage.setItem('authToken', 'session-token')
    sessionStorage.setItem('authUser', '{"id":"user-42"}')
    sessionStorage.setItem('authRedirect', '/app')
    sessionStorage.setItem('verified_token_test', 'true')
    sessionStorage.setItem('rememberToken', 'remember-me-token')
    localStorage.setItem('rememberToken', 'stale-remember-token')

    clearAuthSession()

    expect(getAuthToken()).toBeNull()
    expect(getAuthUser()).toBeNull()
    expect(getAuthUserId()).toBeNull()
    expect(hasAuthSession()).toBe(false)
    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(sessionStorage.getItem('authUser')).toBeNull()
    expect(sessionStorage.getItem('authRedirect')).toBeNull()
    expect(sessionStorage.getItem('verified_token_test')).toBeNull()
    expect(sessionStorage.getItem('rememberToken')).toBeNull()
    expect(localStorage.getItem('rememberToken')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('clears expired JWT credentials when the stored session is read', () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 1 }))
    localStorage.setItem('authToken', `header.${payload}.signature`)
    localStorage.setItem('authUserId', 'user-42')
    localStorage.setItem('theme', 'dark')

    expect(getAuthToken()).toBeNull()
    expect(localStorage.getItem('authUserId')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('stores the protected destination in session storage without exposing it in a URL', () => {
    saveAuthRedirect('/app/workspace-1/team-2/channel-3')

    expect(sessionStorage.getItem('authRedirect')).toBe('/app/workspace-1/team-2/channel-3')
    expect(consumeAuthRedirect()).toBe('/app/workspace-1/team-2/channel-3')
    expect(sessionStorage.getItem('authRedirect')).toBeNull()
  })

  it('does not consume an external redirect destination', () => {
    sessionStorage.setItem('authRedirect', '//example.com')

    expect(consumeAuthRedirect()).toBeNull()
    expect(sessionStorage.getItem('authRedirect')).toBeNull()
  })
})
