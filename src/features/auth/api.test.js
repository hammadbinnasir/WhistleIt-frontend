import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import { resetPassword } from './api'

vi.mock('@/features/channels/api/http', () => ({
  http: vi.fn(),
}))

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts reset credentials to the password reset endpoint', () => {
    const credentials = {
      email: 'sam@example.com',
      token: 'reset-token',
      password: 'new-password-123',
      password_confirmation: 'new-password-123',
    }

    resetPassword(credentials)

    expect(http).toHaveBeenCalledWith('/reset-password', {
      method: 'POST',
      body: credentials,
    })
  })
})
