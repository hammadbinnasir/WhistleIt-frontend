const LINK_PATTERN = /https?:\/\/[^\s<>"']+/gi

export function normalizeMessageContent(content = '') {
  return String(content)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p(?:\s[^>]*)?>/gi, '')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/^\n+|\n+$/g, '')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function linkifyHtml(value) {
  return value.replace(LINK_PATTERN, (rawUrl) => {
    const trailing = rawUrl.match(/[),.!?;:]+$/)?.[0] || ''
    const value = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl
    const url = validHttpUrl(value)
    if (!url) return rawUrl
    return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${value}</a>${trailing}`
  })
}

export function formattedMessageHtml(content = '', isCode = false) {
  if (isCode) {
    return `<pre><code>${escapeHtml(String(content))}</code></pre>`
  }

  let html = escapeHtml(content)
  const codeBlocks = []

  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`)
    return `__WHISTLE_CODE_${codeBlocks.length - 1}__`
  })
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  html = html.replace(/&lt;(u|b|strong|i|em|s|del|strike)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<$1>$2</$1>')
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
  html = html.replace(/(^|[^*])[*]([^*\n]+)[*](?![*])/g, '$1<em>$2</em>')
  html = html.replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
  html = linkifyHtml(html)
  html = html.replace(/\n/g, '<br>')

  return html.replace(/__WHISTLE_CODE_(\d+)__/g, (_, index) => codeBlocks[Number(index)])
}

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

export function relativeTimeLabel(value, now = Date.now()) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return ''

  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < 60_000) return 'just now'

  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function fullDateTimeLabel(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(date)
}
