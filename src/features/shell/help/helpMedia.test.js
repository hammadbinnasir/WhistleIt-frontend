import { describe, expect, it } from 'vitest'

import { resolveMediaSrc, shouldShowMedia } from './helpMedia'

const files = { 'features-2': '/assets/features-2-abc123.gif' }

describe('resolveMediaSrc', () => {
  it('returns null when there is no media entry', () => {
    expect(resolveMediaSrc(null, files)).toBeNull()
    expect(resolveMediaSrc(undefined, files)).toBeNull()
  })

  it('returns null when neither url nor an existing file is set', () => {
    expect(resolveMediaSrc({ name: null, url: null }, files)).toBeNull()
    expect(resolveMediaSrc({ name: 'missing', url: null }, files)).toBeNull()
  })

  it('resolves a local file by its name, whatever its extension', () => {
    expect(resolveMediaSrc({ name: 'features-2', url: null }, files)).toBe(
      '/assets/features-2-abc123.gif',
    )
  })

  it('prefers an external url over a local file', () => {
    const media = { name: 'features-2', url: 'https://example.com/jump.gif' }
    expect(resolveMediaSrc(media, files)).toBe('https://example.com/jump.gif')
  })
})

describe('shouldShowMedia', () => {
  it('hides the slot when no media is defined', () => {
    expect(shouldShowMedia(null, files, true)).toBe(false)
  })

  it('shows an empty slot while developing so the placeholder is visible', () => {
    expect(shouldShowMedia({ name: 'missing', url: null }, files, true)).toBe(true)
  })

  it('hides an empty slot in production but shows a resolved one', () => {
    expect(shouldShowMedia({ name: 'missing', url: null }, files, false)).toBe(false)
    expect(shouldShowMedia({ name: 'features-2', url: null }, files, false)).toBe(true)
  })
})
