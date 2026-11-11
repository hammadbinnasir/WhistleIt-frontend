import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import { getAuthUserId } from '@/features/auth/session'
import { discardVoiceNote, getVoiceNote, getVoiceNoteFile, uploadVoiceNote } from './voiceNotesApi'

vi.mock('@/features/channels/api/http', () => ({ http: vi.fn() }))
vi.mock('@/features/auth/session', () => ({ getAuthUserId: vi.fn() }))

describe('voice notes API', () => {
  beforeEach(() => {
    http.mockReset()
    getAuthUserId.mockReset()
    getAuthUserId.mockReturnValue('user-42')
  })

  it('uploads the recording with channel and user IDs as multipart fields', async () => {
    const recording = new Blob(['audio'], { type: 'audio/webm' })
    http.mockResolvedValue({ data: { voice_note: { id: 12 } } })

    await expect(
      uploadVoiceNote(recording, { channelId: 'channel-9', duration: 3 }),
    ).resolves.toMatchObject({ id: '12' })
    const [path, options] = http.mock.calls[0]
    expect(path).toBe('/v1/voice-notes')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBeInstanceOf(File)
    expect(options.body.get('file').type).toBe('audio/webm')
    expect(options.body.get('duration')).toBe('3')
    expect(options.body.get('channel_id')).toBe('channel-9')
    expect(options.body.get('user_id')).toBe('user-42')
  })

  it('preserves the complete recorded blob in the uploaded file', async () => {
    const recording = new Blob(['first recording chunk', 'last recording chunk'], {
      type: 'audio/webm',
    })
    http.mockResolvedValue({ data: { voice_note: { id: 'voice-full' } } })

    await uploadVoiceNote(recording, { channelId: 'dm-channel-1', duration: 47 })

    const uploadedFile = http.mock.calls[0][1].body.get('file')
    expect(uploadedFile.size).toBe(recording.size)
    await expect(uploadedFile.text()).resolves.toBe('first recording chunklast recording chunk')
    expect(http.mock.calls[0][1].body.get('duration')).toBe('47')
    expect(http.mock.calls[0][1].body.get('channel_id')).toBe('dm-channel-1')
    expect(http.mock.calls[0][1].body.get('user_id')).toBe('user-42')
  })

  it('gets voice-note details, audio file, and discards an unsent recording', async () => {
    const audio = new Blob(['audio'], { type: 'audio/mpeg' })
    http
      .mockResolvedValueOnce({ data: { voice_note: { id: 'note 1', audio_url: '/fresh-link' } } })
      .mockResolvedValueOnce(audio)
      .mockResolvedValueOnce({ success: true })

    await expect(getVoiceNote('note 1')).resolves.toMatchObject({
      id: 'note 1',
      audio_url: '/fresh-link',
    })
    await expect(
      getVoiceNoteFile('note 1', { audio_url: '/fresh-link?signature=valid' }),
    ).resolves.toBe(audio)
    await expect(discardVoiceNote('note 1')).resolves.toBeUndefined()
    expect(http).toHaveBeenNthCalledWith(1, '/v1/voice-notes/note%201')
    expect(http).toHaveBeenNthCalledWith(2, '/fresh-link?signature=valid', {
      auth: false,
      responseType: 'blob',
    })
    expect(http).toHaveBeenNthCalledWith(3, '/v1/voice-notes/note%201', { method: 'DELETE' })
  })

  it('rejects empty recordings and malformed upload responses', async () => {
    await expect(uploadVoiceNote(new Blob())).rejects.toThrow(
      'A non-empty audio recording is required.',
    )
    http.mockResolvedValue({ data: { voice_note: {} } })
    await expect(
      uploadVoiceNote(new Blob(['audio'], { type: 'audio/webm' }), { duration: 1 }),
    ).rejects.toThrow('The voice note response did not contain a voice note ID.')
    expect(http).toHaveBeenCalledOnce()
  })

  it('rejects uploads without a positive duration', async () => {
    await expect(uploadVoiceNote(new Blob(['audio']), { duration: 0 })).rejects.toThrow(
      'A positive voice recording duration in seconds is required.',
    )
    expect(http).not.toHaveBeenCalled()
  })

  it('uses the fresh signed file URL returned by voice-note details', async () => {
    const audio = new Blob(['audio'], { type: 'audio/webm' })
    http.mockResolvedValue(audio)

    await expect(
      getVoiceNoteFile('note-1', { file_url: 'https://api.example.test/audio?signature=abc' }),
    ).resolves.toBe(audio)
    expect(http).toHaveBeenCalledWith('https://api.example.test/audio?signature=abc', {
      auth: false,
      responseType: 'blob',
    })
  })

  it('calls the file endpoint directly when details do not include a fresh link', async () => {
    const audio = new Blob(['audio'], { type: 'audio/webm' })
    http.mockResolvedValue(audio)

    await expect(getVoiceNoteFile('note-1')).resolves.toBe(audio)
    expect(http).toHaveBeenCalledWith('/v1/voice-notes/note-1/file', {
      responseType: 'blob',
    })
  })

  it('rejects channel uploads when the signed-in user ID is unavailable', async () => {
    getAuthUserId.mockReturnValue(null)
    await expect(
      uploadVoiceNote(new Blob(['audio'], { type: 'audio/webm' }), {
        channelId: 'channel-9',
        duration: 1,
      }),
    ).rejects.toThrow(
      'A channel ID and signed-in user ID are required to upload a channel recording.',
    )
    expect(http).not.toHaveBeenCalled()
  })
})
