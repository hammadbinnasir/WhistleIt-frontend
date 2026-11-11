import { afterEach, describe, expect, it, vi } from 'vitest'
import { http } from './http'

describe('http', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('omits cookies by default for wildcard-CORS APIs', async () => {
    sessionStorage.setItem('authToken', 'session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await http('/register', { method: 'POST', body: { email: 'sam@example.com' } })

    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit')
  })

  it('allows cookie credentials when explicitly requested', async () => {
    sessionStorage.setItem('authToken', 'session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await http('/session', { credentials: 'include' })

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('sends an authenticated POST to the logout API URL', async () => {
    sessionStorage.setItem('authToken', 'session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ message: 'Logged out' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await http('/logout', { method: 'POST' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://10.0.105.90:8000/api/logout')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer session-token')
  })

  it('sends multipart data without setting a JSON content type', async () => {
    sessionStorage.setItem('authToken', 'session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const body = new FormData()
    body.append('avatar', new File(['image'], 'avatar.png', { type: 'image/png' }))

    await http('/v1/users/user-1/avatar', { method: 'POST', body })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.body).toBe(body)
    expect(options.headers['Content-Type']).toBeUndefined()
  })

  it('returns file responses as blobs when requested', async () => {
    sessionStorage.setItem('authToken', 'session-token')
    const audio = new Blob(['recording'], { type: 'audio/webm' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(audio),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(http('/v1/voice-notes/note-1/file', { responseType: 'blob' })).resolves.toBe(audio)
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe('application/json')
  })

  it('fetches absolute signed file URLs without adding API auth headers', async () => {
    const audio = new Blob(['recording'], { type: 'audio/webm' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(audio),
    })
    vi.stubGlobal('fetch', fetchMock)
    sessionStorage.setItem('authToken', 'session-token')

    await expect(
      http('https://files.example.test/note?signature=valid', {
        auth: false,
        responseType: 'blob',
      }),
    ).resolves.toBe(audio)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://files.example.test/note?signature=valid')
    expect(options.headers.Authorization).toBeUndefined()
    expect(options.credentials).toBe('omit')
  })

  it('does not duplicate the API base path in root-relative signed URLs', async () => {
    const audio = new Blob(['recording'], { type: 'audio/webm' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(audio),
    })
    vi.stubGlobal('fetch', fetchMock)
    const signedPath =
      '/api/v1/voice-notes/note-1/file?download=1&expires=1793943417&signature=abc123'

    await expect(
      http(signedPath, { auth: false, responseType: 'blob' }),
    ).resolves.toBe(audio)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://10.0.105.90:8000/api/v1/voice-notes/note-1/file?download=1&expires=1793943417&signature=abc123',
    )
  })

  it('removes a duplicated API base path from signed file links', async () => {
    const audio = new Blob(['recording'], { type: 'audio/webm' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(audio),
    })
    vi.stubGlobal('fetch', fetchMock)
    const signedPath =
      '/api/api/v1/voice-notes/note-1/file?download=1&expires=1793943417&signature=abc123'

    await expect(
      http(signedPath, { auth: false, responseType: 'blob' }),
    ).resolves.toBe(audio)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://10.0.105.90:8000/api/v1/voice-notes/note-1/file?download=1&expires=1793943417&signature=abc123',
    )
  })

  it('clears an expired token when the API responds with 401', async () => {
    sessionStorage.setItem('authToken', 'expired-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: 'Unauthenticated' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const expiredHandler = vi.fn()
    window.addEventListener('auth:expired', expiredHandler)

    await expect(http('/channels')).rejects.toThrow('Unauthenticated')

    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(expiredHandler).toHaveBeenCalledOnce()
    window.removeEventListener('auth:expired', expiredHandler)
  })

  it('does not send an authenticated request when no token is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const expiredHandler = vi.fn()
    window.addEventListener('auth:expired', expiredHandler)

    await expect(http('/channels')).rejects.toMatchObject({
      status: 401,
      message: 'Your login session is missing. Please sign in again.',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(expiredHandler).toHaveBeenCalledOnce()
    window.removeEventListener('auth:expired', expiredHandler)
  })

  it('expires the session when the API reports a missing authentication token', async () => {
    sessionStorage.setItem('authToken', 'session-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue({
        success: false,
        message: 'Missing authentication token.',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const expiredHandler = vi.fn()
    window.addEventListener('auth:expired', expiredHandler)

    await expect(http('/channels')).rejects.toMatchObject({
      status: 403,
      message: 'Missing authentication token.',
    })

    expect(sessionStorage.getItem('authToken')).toBeNull()
    expect(expiredHandler).toHaveBeenCalledOnce()
    window.removeEventListener('auth:expired', expiredHandler)
  })
})
