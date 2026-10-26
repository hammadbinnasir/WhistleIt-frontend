const URL_PATTERN = /https?:\/\/[^\s<]+/gi
const TRAILING_URL_PUNCTUATION = /[),.!?;:]+$/

export function extractUrls(text) {
  return [...text.matchAll(URL_PATTERN)].map(([match]) =>
    match.replace(TRAILING_URL_PUNCTUATION, ''),
  )
}

export function createLinkPreview(text) {
  const [url] = extractUrls(text)
  if (!url) return null

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')
    const pathTitle = parsed.pathname
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())

    return {
      url: parsed.href,
      hostname,
      title: pathTitle || hostname,
      description: `Open this link on ${hostname}.`,
    }
  } catch {
    return null
  }
}

export function messageSegments(text) {
  const segments = []
  let cursor = 0
  const addText = (value) => {
    if (!value) return
    const previous = segments.at(-1)
    if (previous?.type === 'text') previous.value += value
    else segments.push({ type: 'text', value })
  }

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index
    const rawUrl = match[0]
    const url = rawUrl.replace(TRAILING_URL_PUNCTUATION, '')
    const trailing = rawUrl.slice(url.length)

    if (start > cursor) addText(text.slice(cursor, start))
    segments.push({ type: 'link', value: url, href: url })
    if (trailing) addText(trailing)
    cursor = start + rawUrl.length
  }

  if (cursor < text.length) addText(text.slice(cursor))
  return segments
}

export function dateLabel(date, now = new Date()) {
  const value = new Date(date)
  const startOfDay = (input) => new Date(input.getFullYear(), input.getMonth(), input.getDate())
  const difference = (startOfDay(now) - startOfDay(value)) / 86_400_000

  if (difference === 0) return 'Today'
  if (difference === 1) return 'Yesterday'

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

export function sameDay(first, second) {
  const a = new Date(first)
  const b = new Date(second)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
