import { describe, expect, it } from 'vitest'
import { customStatusTooltip } from './statusExpiry'

describe('customStatusTooltip', () => {
  it('shows the expiry time when a status has a future expiration', () => {
    const expiresAt = Date.now() + 60_000

    expect(customStatusTooltip('In a meeting', expiresAt)).toMatch(
      /^In a meeting \(Expires at .+\)$/,
    )
  })

  it('shows only the status text when there is no future expiration', () => {
    expect(customStatusTooltip('In a meeting', null)).toBe('In a meeting')
    expect(customStatusTooltip('In a meeting', Date.now() - 1)).toBe('In a meeting')
  })
})
