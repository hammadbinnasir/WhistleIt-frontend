// The ONLY place that knows the backend's field names.
// When the backend team delivers the real contract, adjust these mappers and nothing else.

export function asObject(res) {
  return res?.data ?? res
}

// Accepts: [..] | { data: [..] } | { items: [..], total } | { data: { items, total } }
export function asList(res) {
  const body = res?.data ?? res
  const items = Array.isArray(body) ? body : body?.items ?? []
  const total = Array.isArray(body) ? body.length : body?.total ?? items.length
  return { items, total }
}

export function normalizeChannel(raw = {}) {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    description: raw.description ?? '',
    isPrivate: Boolean(raw.isPrivate),
    isDefault: Boolean(raw.isDefault), // default channels can't be left or archived
    isArchived: Boolean(raw.isArchived),
    isMember: raw.isMember ?? true,
    isFavorite: Boolean(raw.isFavorite),
    isMuted: Boolean(raw.isMuted),
    isUnread: Boolean(raw.isUnread),
    unreadCount: Number(raw.unreadCount) || 0,
    memberCount: Number(raw.memberCount) || 0,
    canManage: Boolean(raw.canManage), // may edit/archive (channel owner or admin)
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
