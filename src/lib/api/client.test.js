import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'
import { expireAuthSession, getAuthToken } from '@/features/auth/session'

vi.mock('@/features/auth/session', () => ({
  getAuthToken: vi.fn(),
  expireAuthSession: vi.fn(),
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

  it('sends FormData without overriding its multipart content type', async () => {
    getAuthToken.mockReturnValue('session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const body = new FormData()
    body.append('attachment', new File(['file'], 'report.txt', { type: 'text/plain' }))

    await apiRequest('/messages', { method: 'POST', body })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.body).toBe(body)
    expect(options.headers['Content-Type']).toBeUndefined()
    expect(options.headers.Accept).toBe('application/json')
  })

  it('maps HTTP and unsuccessful response errors to status and message', async () => {
    getAuthToken.mockReturnValue('session-token')
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

  it('expires the session when the server reports a missing authentication token', async () => {
    getAuthToken.mockReturnValue('session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ success: false, message: 'Missing authentication token.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/company')).rejects.toMatchObject({
      status: 403,
      message: 'Missing authentication token.',
    })
    expect(expireAuthSession).toHaveBeenCalledOnce()
  })

  it('does not send an authenticated request when no token is available', async () => {
    getAuthToken.mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/company')).rejects.toMatchObject({
      status: 401,
      message: 'Your login session is missing. Please sign in again.',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(expireAuthSession).toHaveBeenCalledOnce()
  })
})
