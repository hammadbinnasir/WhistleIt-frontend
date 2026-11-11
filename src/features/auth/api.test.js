import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import { login, logout, requestPasswordReset, resetPassword } from './api'

vi.mock('@/features/channels/api/http', () => ({
  http: vi.fn(),
}))

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('posts the email to the password reset request endpoint', () => {
    requestPasswordReset('sam@example.com')

    expect(http).toHaveBeenCalledWith('/forgetpassword', {
      method: 'POST',
      body: { email: 'sam@example.com' },
      auth: false,
    })
  })

  it('sends the remember choice with normal login credentials', () => {
    const credentials = {
      email: 'sam@example.com',
      password: 'secure-password',
      is_remember: true,
    }

    login(credentials)

    expect(http).toHaveBeenCalledWith('/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    })
  })

  it('sends logout before clearing local auth data and preserves unrelated preferences', async () => {
    localStorage.setItem('authToken', 'saved-token')
    localStorage.setItem('authUserId', 'user-42')
    localStorage.setItem('authUser', '{"id":"user-42"}')
    localStorage.setItem('theme', 'dark')
    sessionStorage.setItem('authToken', 'legacy-token')
    sessionStorage.setItem('rememberToken', 'remember-me-token')
    sessionStorage.setItem('authRedirect', '/app')
    http.mockImplementationOnce(() => {
      expect(localStorage.getItem('authToken')).toBe('saved-token')
      expect(sessionStorage.getItem('rememberToken')).toBe('remember-me-token')
      return Promise.resolve({ message: 'Logged out' })
    })

    await logout()

    expect(http).toHaveBeenCalledWith('/logout', {
      method: 'POST',
      body: { is_remember: false },
    })
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(localStorage.getItem('authUserId')).toBeNull()
    expect(localStorage.getItem('authUser')).toBeNull()
    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(sessionStorage.getItem('rememberToken')).toBeNull()
    expect(sessionStorage.getItem('authRedirect')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('posts reset credentials to the token-specific password reset endpoint', () => {
    const credentials = {
      email: 'sam@example.com',
      password: 'new-password-123',
      password_confirmation: 'new-password-123',
    }

    resetPassword('reset/token', credentials)

    expect(http).toHaveBeenCalledWith('/forgetpassword/reset%2Ftoken', {
      method: 'POST',
      body: credentials,
      auth: false,
    })
  })

  it('allows password reset credentials without an email when the token identifies the account', () => {
    const credentials = {
      password: 'new-password-123',
      password_confirmation: 'new-password-123',
    }

    resetPassword('reset-token', credentials)

    expect(http).toHaveBeenCalledWith('/forgetpassword/reset-token', {
      method: 'POST',
      body: credentials,
      auth: false,
    })
  })
})
