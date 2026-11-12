import { http } from '@/features/channels/api/http'
import {
  fetchMessageAttachment,
  recentFileAttachmentContext,
} from '@/features/messages/messageAttachments'

function requireCompanyId(companyId) {
  if (companyId == null || String(companyId).trim() === '') {
    throw new Error('A company ID is required to load recent files.')
  }
}

function filesFrom(response) {
  let value = response
  for (let depth = 0; depth < 5 && value && !Array.isArray(value); depth += 1) {
    value = value.files ?? value.recent_files ?? value.recentFiles ?? value.results ?? value.data
  }
  if (!Array.isArray(value)) {
    throw new Error('The recent files response does not contain a file list.')
  }
  return value
}

function uniqueRecentFiles(files) {
  const latestByIdentity = new Map()

  files.forEach((file, index) => {
    const id = recentFileId(file)
    const path = String(file?.path ?? file?.storage_path ?? file?.file_path ?? '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .toLowerCase()
    const name = recentFileName(file).trim().replace(/\s+/g, ' ').toLowerCase()
    const mimeType = String(file?.mime_type ?? file?.mimeType ?? file?.type ?? '')
      .trim()
      .toLowerCase()
    const identity = name ? `name:${name}|type:${mimeType}` : path ? `path:${path}` : `id:${id}`
    const date = Date.parse(recentFileDate(file) || '') || 0
    const previous = latestByIdentity.get(identity)

    if (!previous || date > previous.date) latestByIdentity.set(identity, { index, date })
  })

  const retainedIndexes = new Set([...latestByIdentity.values()].map(({ index }) => index))
  return files.filter((_, index) => retainedIndexes.has(index))
}

export async function listRecentFiles(companyId) {
  requireCompanyId(companyId)
  const response = await http('/v1/files/recent', {
    method: 'GET',
    params: { company_id: companyId },
  })
  return uniqueRecentFiles(filesFrom(response))
}

export function recentFileId(file) {
  const id = file?.id ?? file?.file_id ?? file?.fileId
  return id == null || String(id).trim() === '' ? '' : String(id)
}

export function recentFileName(file) {
  return String(
    file?.name ??
      file?.file_name ??
      file?.fileName ??
      file?.filename ??
      file?.original_name ??
      file?.originalName ??
      'File',
  )
}

export async function downloadRecentFile(file, context = {}) {
  const attachmentContext = recentFileAttachmentContext(file, context)
  let blob

  try {
    blob = await fetchMessageAttachment(file, attachmentContext)
  } catch (error) {
    const hasSourceType =
      file?.team_id != null ||
      file?.teamId != null ||
      file?.team != null ||
      file?.direct_channel_id != null ||
      file?.directChannelId != null ||
      file?.direct_channel != null ||
      file?.conversation_type != null ||
      file?.conversationType != null ||
      file?.chat_type != null ||
      file?.chatType != null ||
      file?.source_type != null ||
      file?.sourceType != null ||
      file?.channel_type != null ||
      file?.is_direct != null ||
      file?.isDirect != null
    if (hasSourceType || error?.status !== 404 || !attachmentContext.teamId) throw error

    blob = await fetchMessageAttachment(file, {
      ...attachmentContext,
      conversationType: 'dm',
    })
  }

  const type = String(
    file?.mime_type || file?.mimeType || file?.type || blob.type || 'application/octet-stream',
  )
  return new File([blob], recentFileName(file), { type })
}

export function recentFileDate(file) {
  return (
    file?.created_at ?? file?.uploaded_at ?? file?.createdAt ?? file?.uploadedAt ?? file?.date ?? ''
  )
}
