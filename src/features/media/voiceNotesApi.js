import { http } from '@/features/channels/api/http'
import { getAuthUserId } from '@/features/auth/session'

const VOICE_NOTES_PATH = '/v1/voice-notes'
const encoded = encodeURIComponent

function payloadOf(response) {
  let payload = response?.data ?? response
  if (payload?.data != null) payload = payload.data
  return payload
}

function voiceNoteOf(response) {
  const payload = payloadOf(response)
  return payload?.voice_note ?? payload?.voiceNote ?? payload
}

function voiceNoteId(note) {
  const id = note?.id ?? note?.voice_note_id ?? note?.voiceNoteId
  if (id == null || id === '') {
    throw new Error('The voice note response did not contain a voice note ID.')
  }
  return String(id)
}

export async function uploadVoiceNote(blob, { channelId = null, duration } = {}) {
  if (!(blob instanceof Blob) || !blob.size) {
    throw new Error('A non-empty audio recording is required.')
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('A positive voice recording duration in seconds is required.')
  }
  const userId = getAuthUserId()
  if (channelId != null && (String(channelId) === '' || userId == null || String(userId) === '')) {
    throw new Error('A channel ID and signed-in user ID are required to upload a channel recording.')
  }
  const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const file = new File([blob], `voice-note-${Date.now()}.${extension}`, {
    type: blob.type || 'audio/webm',
  })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('duration', String(duration))
  if (channelId != null) formData.append('channel_id', String(channelId))
  if (userId != null) formData.append('user_id', String(userId))
  const response = await http(VOICE_NOTES_PATH, { method: 'POST', body: formData })
  const note = voiceNoteOf(response)
  return { ...note, id: voiceNoteId(note) }
}

export async function getVoiceNote(id) {
  if (id == null || id === '') throw new Error('A voice note ID is required.')
  const response = await http(`${VOICE_NOTES_PATH}/${encoded(id)}`)
  const note = voiceNoteOf(response)
  return { ...note, id: voiceNoteId(note) }
}

function freshFileUrl(details) {
  const links = details?.links ?? details?.fresh_links ?? details?.urls
  return (
    details?.file_url ??
    details?.audio_url ??
    details?.download_url ??
    details?.signed_url ??
    details?.url ??
    links?.file_url ??
    links?.audio_url ??
    links?.download_url ??
    links?.file ??
    links?.audio ??
    links?.download ??
    null
  )
}

export async function getVoiceNoteFile(id, details = null) {
  if (id == null || id === '') throw new Error('A voice note ID is required.')
  const fileUrl = freshFileUrl(details)
  return http(fileUrl || `${VOICE_NOTES_PATH}/${encoded(id)}/file`, {
    ...(fileUrl ? { auth: false } : {}),
    responseType: 'blob',
  })
}

export async function discardVoiceNote(id) {
  if (id == null || id === '') throw new Error('A voice note ID is required.')
  await http(`${VOICE_NOTES_PATH}/${encoded(id)}`, { method: 'DELETE' })
}
