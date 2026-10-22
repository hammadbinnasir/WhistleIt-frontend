import { afterEach, describe, expect, it, vi } from 'vitest'
import { http } from './http'

describe('http', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('omits cookies by default for wildcard-CORS APIs', async () => {
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await http('/session', { credentials: 'include' })

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })
})
