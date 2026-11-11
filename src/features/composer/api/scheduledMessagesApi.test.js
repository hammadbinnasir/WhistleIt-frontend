import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRememberToken } from '@/features/auth/session'
import { getScheduledMessages } from './scheduledMessagesApi'

vi.mock('@/features/auth/session', () => ({
  getAuthToken: vi.fn(() => null),
  getRememberToken: vi.fn(),
}))

describe('scheduled messages API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sends the remember-token header', async () => {
    getRememberToken.mockReturnValue('remember-me-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getScheduledMessages()

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['X-Remember-Token']).toBe('remember-me-token')
  })
})
