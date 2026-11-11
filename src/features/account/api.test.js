import { beforeEach, describe, expect, it, vi } from 'vitest'

const http = vi.hoisted(() => vi.fn())
vi.mock('@/features/channels/api/http', () => ({ http }))

import { getUser, getUserProfile, updateUserEmailVisibility } from './api'

describe('account API', () => {
  beforeEach(() => http.mockReset())

  it('gets a user profile from the profile endpoint', async () => {
    http.mockResolvedValue({ success: true, data: { presence: 'away', status_mode: 'away' } })

    await expect(getUserProfile('user 1')).resolves.toEqual({
      success: true,
      data: { presence: 'away', status_mode: 'away' },
    })
    expect(http).toHaveBeenCalledWith('/v1/users/user%201/profile')
  })

  it('gets a user from the user endpoint', async () => {
    http.mockResolvedValue({ success: true, data: { id: 'user 1', status_mode: 'away' } })

    await expect(getUser('user 1')).resolves.toEqual({
      success: true,
      data: { id: 'user 1', status_mode: 'away' },
    })
    expect(http).toHaveBeenCalledWith('/v1/users/user%201')
  })

  it('updates email visibility for a user', async () => {
    http.mockResolvedValue({ success: true })

    await updateUserEmailVisibility('user 1', false)

    expect(http).toHaveBeenCalledWith('/v1/users/user%201/email-visibility', {
      method: 'PATCH',
      body: { email_visibility: false },
    })
  })
})
