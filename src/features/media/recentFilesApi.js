import { http } from '@/features/channels/api/http'
import { messageAttachmentUrl } from '@/features/messages/messageAttachments'

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

export async function listRecentFiles(companyId) {
  requireCompanyId(companyId)
  const response = await http('/v1/files/recent', {
    method: 'GET',
    params: { company_id: companyId },
  })
  return filesFrom(response)
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

export async function downloadRecentFile(file) {
  const url = messageAttachmentUrl({
    ...file,
    url: file?.fileUrl ?? file?.downloadUrl ?? file?.download_url ?? file?.url,
  })
  if (!url) throw new Error('This recent file does not have a download URL.')

  const blob = await http(url, { responseType: 'blob' })
  if (!(blob instanceof Blob)) {
    throw new Error('The recent file download did not return file data.')
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
