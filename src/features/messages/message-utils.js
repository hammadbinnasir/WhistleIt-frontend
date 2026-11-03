const LINK_PATTERN = /https?:\/\/[^\s<>"']+/gi

export function validHttpUrl(value) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
      ? url
      : null
  } catch {
    return null
  }
}

export function messageSegments(content = '') {
  const segments = []
  let start = 0

  for (const match of content.matchAll(LINK_PATTERN)) {
    const rawUrl = match[0]
    const trailing = rawUrl.match(/[),.!?;:]+$/)?.[0] || ''
    const value = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl
    const url = validHttpUrl(value)
    if (!url) continue

    const index = match.index
    if (index > start) segments.push({ text: content.slice(start, index) })
    segments.push({ text: value, href: url.href })
    if (trailing) segments.push({ text: trailing })
    start = index + rawUrl.length
  }

  if (start < content.length) segments.push({ text: content.slice(start) })
  return segments
}

export function createLinkPreview(content = '') {
  const match = content.match(LINK_PATTERN)?.[0]
  if (!match) return null
  const cleanUrl = match.replace(/[),.!?;:]+$/, '')
  const url = validHttpUrl(cleanUrl)
  if (!url) return null

  const path = decodePath(url.pathname).split('/').filter(Boolean).at(-1)?.replace(/[-_]/g, ' ')
  const title = path
    ? path.replace(/\.[a-z0-9]{1,8}$/i, '').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : url.hostname

  return {
    href: url.href,
    hostname: url.hostname,
    title: title || url.hostname,
    description: 'Open this link to view the shared content.',
  }
}

function decodePath(path) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function sameDay(left, right) {
  const a = new Date(left)
  const b = new Date(right)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function dateLabel(value) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

export function timeLabel(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(value),
  )
}
