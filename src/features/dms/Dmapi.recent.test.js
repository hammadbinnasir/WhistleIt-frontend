import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/features/dms/dmApi')
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import { dmApi, recentAtOf } from './dmApi'

describe('DM API: PATCH /v1/{company}/direct-channels/{channel}/recent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends PATCH with the encoded company + channel and a JSON body', async () => {
    apiRequest.mockResolvedValue({ data: { id: 'c 1', recent_at: '2026-11-10T13:00:00Z' } })
    const at = '2026-11-10T12:59:59.000Z'

    await expect(dmApi.markRecent('company/1', 'c 1', at)).resolves.toBe('2026-11-10T13:00:00Z')

    expect(apiRequest).toHaveBeenCalledWith('/v1/company%2F1/direct-channels/c%201/recent', {
      method: 'PATCH',
      body: JSON.stringify({ is_recent: true }),
    })
  })

  it('treats 204 / empty body as success', async () => {
    apiRequest.mockResolvedValue(undefined)
    await expect(dmApi.markRecent('company-1', 'c1')).resolves.toBe('')
    apiRequest.mockRejectedValue(Object.assign(new SyntaxError('Unexpected end of JSON input'), { status: 204 }))
    await expect(dmApi.markRecent('company-1', 'c1')).resolves.toBe('')
  })

  it('passes real errors through (store decides retry / error)', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    await expect(dmApi.markRecent('company-1', 'c1')).rejects.toThrow('Forbidden')
  })

  it('needs company and channel before any request', () => {
    expect(() => dmApi.markRecent('', 'c1')).toThrow(/company ID/)
    expect(() => dmApi.markRecent('company-1', '')).toThrow(/channel ID/)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('reads the recent time from any backend field name', () => {
    expect(recentAtOf({ last_opened_at: 'a' })).toBe('a')
    expect(recentAtOf({ last_viewed_at: 'b' })).toBe('b')
    expect(recentAtOf(null)).toBe('')
  })
})