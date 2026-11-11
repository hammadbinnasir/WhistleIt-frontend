import { describe, expect, it } from 'vitest'
import {
  messageAttachmentKind,
  messageAttachmentUrl,
  normalizeMessageAttachments,
} from './messageAttachments'

describe('message attachment helpers', () => {
  it('normalizes the backend singular attachment field to a list', () => {
    const file = { id: 'file-1', name: 'photo.jpg' }

    expect(normalizeMessageAttachments({ attachment: [file] })).toEqual([file])
    expect(normalizeMessageAttachments({ attachment: file })).toEqual([file])
    expect(normalizeMessageAttachments({ attachments: [file] })).toEqual([file])
    expect(normalizeMessageAttachments({ attachments: [], attachment: [file] })).toEqual([file])
    expect(normalizeMessageAttachments({})).toEqual([])
  })

  it('resolves backend storage paths through the Laravel public storage URL', () => {
    expect(messageAttachmentUrl({ path: 'messages/channel-1/photo.jpg' })).toBe(
      'http://10.0.105.90:8000/storage/messages/channel-1/photo.jpg',
    )
  })

  it('prefers a backend-provided file URL', () => {
    expect(messageAttachmentUrl({ path: 'ignored.jpg', file_url: '/files/photo.jpg' })).toBe(
      'http://10.0.105.90:8000/files/photo.jpg',
    )
  })

  it('returns an empty URL if the backend did not include a URL or path', () => {
    expect(messageAttachmentUrl({ name: 'photo.jpg' })).toBe('')
  })

  it.each([
    [{ name: 'photo.JPG' }, 'image'],
    [{ name: 'report.pdf' }, 'pdf'],
    [{ name: 'report.doc' }, 'word'],
    [{ name: 'report.docx' }, 'word'],
    [{ name: 'archive.zip' }, 'file'],
  ])('classifies %o attachments', (file, expectedKind) => {
    expect(messageAttachmentKind(file)).toBe(expectedKind)
  })
})
