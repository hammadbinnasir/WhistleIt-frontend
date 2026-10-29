import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import { logout, requestPasswordReset, resetPassword } from './api'

vi.mock('@/features/channels/api/http', () => ({
  http: vi.fn(),
}))

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts the email to the password reset request endpoint', () => {
    requestPasswordReset('sam@example.com')

    expect(http).toHaveBeenCalledWith('/forgetpassword', {
      method: 'POST',
      body: { email: 'sam@example.com' },
      auth: false,
    })
  })

  it('posts to the authenticated logout endpoint', () => {
    logout()

    expect(http).toHaveBeenCalledWith('/logout', { method: 'POST' })
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
})
