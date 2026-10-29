import { describe, expect, it } from 'vitest'
import { createLinkPreview, messageSegments, sameDay } from './message-utils'

describe('message link and date helpers', () => {
  it('creates safe link metadata and preserves surrounding text', () => {
    const content = 'Read this: https://example.com/team/launch-plan.'
    expect(createLinkPreview(content)).toMatchObject({
      hostname: 'example.com',
      title: 'Launch Plan',
      href: 'https://example.com/team/launch-plan',
    })
    expect(messageSegments(content)).toEqual([
      { text: 'Read this: ' },
      {
        text: 'https://example.com/team/launch-plan',
        href: 'https://example.com/team/launch-plan',
      },
      { text: '.' },
    ])
  })

  it('rejects unsafe and non-http links', () => {
    expect(createLinkPreview('javascript:alert(1)')).toBeNull()
    expect(createLinkPreview('file:///etc/passwd')).toBeNull()
    expect(createLinkPreview('https://untrusted.example@trusted.example/')).toBeNull()
    expect(messageSegments('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
  })

  it('creates a preview for paths containing invalid encoded characters', () => {
    expect(createLinkPreview('https://example.com/%E0')).toMatchObject({
      hostname: 'example.com',
      title: '%E0',
    })
  })

  it('compares message calendar dates', () => {
    expect(sameDay('2026-10-29T08:00:00+05:00', '2026-10-29T21:00:00+05:00')).toBe(true)
    expect(sameDay('2026-10-28T23:59:00+05:00', '2026-10-29T00:01:00+05:00')).toBe(false)
  })
})
