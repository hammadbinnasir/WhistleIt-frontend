import { describe, expect, it } from 'vitest'
import {
  createLinkPreview,
  formattedMessageHtml,
  fullDateTimeLabel,
  messageSegments,
  normalizeMessageContent,
  relativeTimeLabel,
  sameDay,
} from './message-utils'

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

  it('renders supported formatting without exposing raw tags or unsafe HTML', () => {
    expect(
      formattedMessageHtml('**bold** *italic* ~~strike~~ <u>underlined</u> <script>alert(1)</script>'),
    ).toBe(
      '<strong>bold</strong> <em>italic</em> <s>strike</s> <u>underlined</u> &lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('renders the plain-text underline marker used by the composer', () => {
    expect(formattedMessageHtml('++underlined++')).toBe('<u>underlined</u>')
  })

  it('renders fenced code as a full code block', () => {
    expect(formattedMessageHtml('```\nconst value = 1\nconsole.log(value)\n```')).toBe(
      '<pre><code>const value = 1\nconsole.log(value)</code></pre>',
    )
  })

  it('renders API code messages as escaped code blocks', () => {
    expect(formattedMessageHtml('const x = 1\n  return x', true)).toBe(
      '<pre><code>const x = 1\n  return x</code></pre>',
    )
    expect(formattedMessageHtml('<script>alert(1)</script>', true)).toBe(
      '<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>',
    )
  })

  it('removes API paragraph wrappers while retaining message text and paragraph breaks', () => {
    expect(normalizeMessageContent('<p>byeee</p>')).toBe('byeee')
    expect(normalizeMessageContent('<p>first</p><p>second<br>line</p>')).toBe(
      'first\nsecond\nline',
    )
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

  it('formats channel message times relatively and provides a complete hover timestamp', () => {
    const now = Date.parse('2026-11-10T12:00:00Z')

    expect(relativeTimeLabel('2026-11-10T11:59:45Z', now)).toBe('just now')
    expect(relativeTimeLabel('2026-11-10T11:48:00Z', now)).toBe('12 minutes ago')
    expect(relativeTimeLabel('2026-11-10T09:00:00Z', now)).toBe('3 hours ago')
    expect(relativeTimeLabel('2026-11-07T12:00:00Z', now)).toBe('3 days ago')
    expect(fullDateTimeLabel('2026-11-10T12:00:00Z')).toContain('2026')
    expect(relativeTimeLabel('invalid', now)).toBe('')
  })
})
