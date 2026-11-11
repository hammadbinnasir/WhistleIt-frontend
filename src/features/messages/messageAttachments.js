import { getAuthToken } from '@/features/auth/session'
import { http } from '@/features/channels/api/http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://10.0.105.90:8000/api'

export function normalizeMessageAttachments(message = {}) {
  const attachments = [message.attachments, message.attachment, message.files].find((value) =>
    Array.isArray(value) ? value.length > 0 : value && typeof value === 'object',
  )
  if (attachments == null) return []
  if (Array.isArray(attachments)) return attachments
  return attachments && typeof attachments === 'object' ? [attachments] : []
}

export function messageAttachmentKind(attachment) {
  const name = String(attachment?.name ?? attachment?.file_name ?? '').toLowerCase()
  const mimeType = String(
    attachment?.mime_type ?? attachment?.mimeType ?? attachment?.type ?? '',
  ).toLowerCase()

  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image'
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.(doc|docx)$/.test(name)
  ) {
    return 'word'
  }
  return 'file'
}

export function messageAttachmentUrl(attachment) {
  const baseUrl = new URL(API_BASE_URL, globalThis.location?.origin || 'http://localhost')
  const directUrls = [
    attachment?.url,
    attachment?.fileUrl,
    attachment?.downloadUrl,
    attachment?.attachment_url,
    attachment?.file_url,
    attachment?.download_url,
    attachment?.signed_url,
  ]

  for (const directUrl of directUrls) {
    if (typeof directUrl !== 'string' || !directUrl.trim() || /^blob:/i.test(directUrl.trim())) {
      continue
    }
    const url = new URL(directUrl.trim(), baseUrl.origin)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  }

  const path = [attachment?.path, attachment?.storage_path, attachment?.file_path].find(
    (value) => typeof value === 'string' && value.trim() && !/^blob:/i.test(value.trim()),
  )
  if (typeof path !== 'string' || !path.trim()) return ''

  if (/^https?:\/\//i.test(path.trim())) return new URL(path.trim()).href
  const relativePath = path
    .trim()
    .replace(/^\/+/, '')
    .replace(/^storage\//, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  return new URL(`/storage/${relativePath}`, baseUrl.origin).href
}

export function messageAttachmentEndpoint(
  attachment,
  { conversationType, companyId, teamId, channelId, messageId } = {},
) {
  const attachmentId =
    attachment?.id ??
    attachment?.attachment_id ??
    attachment?.attachmentId ??
    attachment?.file_id ??
    attachment?.fileId
  const requiredIds =
    conversationType === 'dm'
      ? [companyId, channelId, messageId, attachmentId]
      : conversationType === 'channel'
        ? [companyId, teamId, channelId, messageId, attachmentId]
        : []

  if (!requiredIds.length || requiredIds.some((id) => id == null || String(id).trim() === '')) {
    throw new Error('The attachment is missing its message or file ID.')
  }

  const encode = (value) => encodeURIComponent(String(value))
  const messagePath =
    conversationType === 'dm'
      ? `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}/messages/${encode(messageId)}`
      : `/v1/${encode(companyId)}/teams/${encode(teamId)}/channels/${encode(channelId)}/messages/${encode(messageId)}`
  return `${messagePath}/attachments/${encode(attachmentId)}`
}

export async function fetchMessageAttachment(attachment, context) {
  const path = messageAttachmentEndpoint(attachment, context)
  const rememberToken =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('rememberToken') || getAuthToken()
      : getAuthToken()
  const blob = await http(path, {
    responseType: 'blob',
    ...(rememberToken ? { headers: { 'ex-remember-token': rememberToken } } : {}),
  })

  if (!(blob instanceof Blob)) {
    throw new Error('The attachment download did not return file data.')
  }
  return blob
}
