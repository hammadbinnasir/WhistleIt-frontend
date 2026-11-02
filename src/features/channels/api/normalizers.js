// The ONLY place that knows the backend's field names.
// When the backend team delivers the real contract, adjust these mappers and nothing else.

export function asObject(res) {
  const body = res?.data ?? res
  const payload = body?.data ?? body
  return payload?.channel ?? body?.channel ?? payload
}

// Accepts: [..] | { data: [..] } | { items: [..], total } | { data: { items, total } }
export function asList(res) {
  const body = res?.data ?? res
  const payload = body?.data ?? body
  const items = Array.isArray(payload)
    ? payload
    : (payload?.items ?? payload?.channels ?? [])
  const total = Array.isArray(payload) ? payload.length : (payload?.total ?? items.length)
  return { items, total }
}

export function normalizeChannel(raw = {}) {
  const record = raw?.channel ?? raw
  const id = record.id ?? record.channel_id
  const name = record.name ?? record.channel_name ?? record.title
  if (id == null || !String(name ?? '').trim()) {
    throw new Error('A channel response is missing its ID or name.')
  }

  const rawPrivate = record.isPrivate ?? record.is_private
  const rawMember = record.isMember ?? record.is_member
  const type = String(record.type ?? record.channel_type ?? '').toLowerCase()
  return {
    id: String(id),
    name: String(name).trim(),
    description: record.description ?? record.channel_description ?? '',
    isPrivate:
      rawPrivate == null
        ? type === 'private'
        : rawPrivate === true ||
          rawPrivate === 1 ||
          String(rawPrivate).toLowerCase() === 'true',
    isDefault: Boolean(record.isDefault ?? record.is_default),
    isArchived: Boolean(record.isArchived ?? record.is_archived),
    isMember:
      rawMember === true ||
      rawMember === 1 ||
      String(rawMember).toLowerCase() === 'true',
    isFavorite: Boolean(record.isFavorite ?? record.is_favorite),
    isMuted: Boolean(record.isMuted ?? record.is_muted),
    isUnread: Boolean(record.isUnread ?? record.is_unread),
    unreadCount: Number(record.unreadCount ?? record.unread_count) || 0,
    memberCount: Number(record.memberCount ?? record.member_count) || 0,
    canManage: Boolean(record.canManage ?? record.can_manage),
  }
}

export function normalizeMember(raw = {}) {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    avatarUrl: raw.avatarUrl ?? '',
    status: ['online', 'away'].includes(raw.status) ? raw.status : 'offline',
  }
}
