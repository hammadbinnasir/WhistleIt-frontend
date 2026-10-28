import { describe, expect, it } from 'vitest'
import { createLinkPreview, dateLabel, messageSegments, sameDay } from './message-utils'

describe('message utilities', () => {
  it('generates safe URL metadata for a message link', () => {
    expect(createLinkPreview('Read this: https://www.example.com/getting-started.')).toEqual({
      url: 'https://www.example.com/getting-started',
      hostname: 'example.com',
      title: 'Getting Started',
      description: 'Open this link on example.com.',
    })
  })

  it('does not create a preview when no URL is present', () => {
    expect(createLinkPreview('A message without a link')).toBeNull()
  })

  it('splits message text into text and clickable links', () => {
    expect(messageSegments('See https://example.com/page, thanks')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://example.com/page', href: 'https://example.com/page' },
      { type: 'text', value: ', thanks' },
    ])
  })

  it('labels dates and checks whether timestamps share a calendar day', () => {
    const now = new Date(2026, 9, 26, 14)
    expect(dateLabel(new Date(2026, 9, 26, 8), now)).toBe('Today')
    expect(dateLabel(new Date(2026, 9, 25, 8), now)).toBe('Yesterday')
    expect(sameDay(new Date(2026, 9, 26, 8), new Date(2026, 9, 26, 22))).toBe(true)
  })
})
