import { messageSegments } from '@/features/messages/message-utils'
import {
  messageAttachmentKind,
  messageAttachmentUrl,
  normalizeMessageAttachments,
} from '@/features/messages/messageAttachments'

// SearchPage supplies messages loaded from the API; this module applies local filters.

const FILES = []
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// Lets the composer / upload code make a sent file show up in File search (mock mode only).
export function addMockFile(file) {
  FILES.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...file })
}

function applyFilters(
  list,
  { q, userIds = [], date, dateEnd, dateMode = 'on', webhooks, channelId, dmConversationId },
  textKey,
) {
  const needle = (q || '').toLowerCase()
  return list.filter(
    (i) =>
      (!needle || String(i[textKey]).toLowerCase().includes(needle)) &&
      (!userIds.length || userIds.map(String).includes(String(i.userId))) &&
      (!date ||
        (dateMode === 'before' && String(i.createdAt || '').slice(0, 10) < date) ||
        (dateMode === 'after' && String(i.createdAt || '').slice(0, 10) > date) ||
        (dateMode === 'range' &&
          String(i.createdAt || '').slice(0, 10) >= date &&
          (!dateEnd || String(i.createdAt || '').slice(0, 10) <= dateEnd)) ||
        (dateMode === 'on' && String(i.createdAt || '').slice(0, 10) === date)) &&
      (!webhooks || i.webhook) &&
      (!channelId || String(i.conversation?.id ?? '') === String(channelId)) &&
      (!dmConversationId ||
        (i.conversation?.kind === 'dm' &&
          String(i.conversation?.id ?? '') === String(dmConversationId))),
  )
}

export async function searchMessages(p) {
  await wait()
  const combined = getSearchableMessages(p)
  const filtered = applyFilters(combined, p, 'text')
  const page = p.page || 1
  const pageSize = p.pageSize || filtered.length || 1
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    total: filtered.length,
  }
}

function getSearchableMessages({ dmMessages = [], channelMessages = [] } = {}) {
  const combined = [
    ...(Array.isArray(channelMessages) ? channelMessages : []),
    ...(Array.isArray(dmMessages) ? dmMessages : []),
  ]
  return combined.filter(
    (message, index, messages) =>
      messages.findIndex(
        (candidate) =>
          String(candidate.id) === String(message.id) &&
          String(candidate.conversation?.id ?? '') === String(message.conversation?.id ?? ''),
      ) === index,
  )
}

export async function searchLinks(p) {
  await wait()
  const links = getSearchableMessages(p).flatMap((message) =>
    messageSegments(String(message.text ?? message.content ?? ''))
      .filter((segment) => segment.href)
      .map((segment, index) => ({
        id: message.id,
        url: segment.text,
        sender: message.sender || 'Unknown user',
        userId: message.userId || '',
        createdAt: message.createdAt || '',
        webhook: Boolean(message.webhook),
        conversation: message.conversation,
        linkIndex: index,
      })),
  )
  const filtered = applyFilters(links, p, 'url')
  const page = p.page || 1
  const pageSize = p.pageSize || 6
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    total: filtered.length,
  }
}
export async function searchFiles(p) {
  await wait()
  const messageFiles = getSearchableMessages(p).flatMap((message) =>
    normalizeMessageAttachments(message).map((attachment, index) => {
      const name =
        attachment.name ??
        attachment.file_name ??
        attachment.fileName ??
        attachment.filename ??
        attachment.original_name ??
        attachment.originalName ??
        'Attachment'
      const kind = messageAttachmentKind(attachment)
      const mimeType = String(
        attachment.mime_type ?? attachment.mimeType ?? attachment.type ?? '',
      ).toLowerCase()

      return {
        id: `${message.id}-${attachment.id ?? attachment.attachment_id ?? index}`,
        messageId: message.id,
        attachment,
        name: String(name),
        type:
          kind === 'file' && mimeType.startsWith('audio/')
            ? 'audio'
            : kind === 'word'
              ? 'doc'
              : kind,
        url: messageAttachmentUrl(attachment),
        sharedBy: message.sender || 'Unknown user',
        userId: message.userId || '',
        createdAt: message.createdAt || '',
        webhook: Boolean(message.webhook),
        conversation: message.conversation,
        companyId: p.companyId,
        teamId: p.teamId,
      }
    }),
  )
  const all = applyFilters([...FILES, ...messageFiles], p, 'name')
  const size = p.pageSize || 6
  const page = p.page || 1
  return {
    items: all.slice((page - 1) * size, page * size),
    totalPages: Math.max(1, Math.ceil(all.length / size)),
    total: all.length,
  }
}
export async function searchUsers() {
  return []
}
