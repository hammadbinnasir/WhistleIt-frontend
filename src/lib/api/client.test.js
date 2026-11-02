import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'
import { getAuthToken } from '@/features/auth/session'

vi.mock('@/features/auth/session', () => ({
  getAuthToken: vi.fn(),
}))

describe('shared API client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('merges default, authorization, and caller headers while preserving request options', async () => {
    const token = ['unit', 'test'].join('-')
    getAuthToken.mockReturnValue(token)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 1 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest('/company', {
      method: 'POST',
      headers: { 'X-Request-Id': 'request-1' },
      body: JSON.stringify({ name: 'Example' }),
    })

    expect(result).toEqual({ success: true, data: { id: 1 } })
    const [, options] = fetchMock.mock.calls[0]
    expect(options).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'Example' }),
    })
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-Id': 'request-1',
    })
  })

  it('maps HTTP and unsuccessful response errors to status and message', async () => {
    getAuthToken.mockReturnValue(null)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ success: false, message: 'Access denied.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: false, message: 'Company unavailable.' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => ({}),
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/company')).rejects.toMatchObject({
      status: 403,
      message: 'Access denied.',
    })
    await expect(apiRequest('/company')).rejects.toMatchObject({
      status: 200,
      message: 'Company unavailable.',
    })
    await expect(apiRequest('/company')).rejects.toMatchObject({
      status: 502,
      message: 'Bad Gateway',
    })
  })
})
