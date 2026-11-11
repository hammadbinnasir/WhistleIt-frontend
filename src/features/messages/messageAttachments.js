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
  if (typeof attachment?.localPreviewUrl === 'string' && attachment.localPreviewUrl) {
    return attachment.localPreviewUrl
  }
  const directUrl =
    attachment?.url ??
    attachment?.attachment_url ??
    attachment?.file_url ??
    attachment?.download_url ??
    attachment?.signed_url
  const baseUrl = new URL(API_BASE_URL, globalThis.location?.origin || 'http://localhost')

  if (typeof directUrl === 'string' && directUrl.trim()) {
    return new URL(directUrl, baseUrl.origin).href
  }

  const path = attachment?.path ?? attachment?.storage_path ?? attachment?.file_path
  if (typeof path !== 'string' || !path.trim()) return ''

  const relativePath = path
    .trim()
    .replace(/^\/+/, '')
    .replace(/^storage\//, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  return new URL(`/storage/${relativePath}`, baseUrl.origin).href
}
