import { describe, expect, it } from 'vitest'
import { customStatusTooltip } from './statusExpiry'

describe('customStatusTooltip', () => {
  it('shows the expiry time when a status has a future expiration', () => {
    const expiresAt = Date.now() + 60_000

    expect(customStatusTooltip('In a meeting', expiresAt)).toMatch(
      /^In a meeting \(Expires at .+, .+\)$/,
    )
  })

  it('formats an ISO expiry with a readable date and time', () => {
    const formatted = customStatusTooltip(
      'Commuting',
      '2026-11-11T11:35:32+00:00',
      new Date('2026-11-11T10:00:00Z').getTime(),
    )

    expect(formatted).toMatch(/^Commuting \(Expires at .+, .+\)$/)
    expect(formatted).toContain('2026')
    expect(formatted).not.toContain('T11:35:32')
  })

  it('shows only the status text when there is no future expiration', () => {
    expect(customStatusTooltip('In a meeting', null)).toBe('In a meeting')
    expect(customStatusTooltip('In a meeting', Date.now() - 1)).toBe('In a meeting')
  })
})
