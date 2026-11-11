import { describe, expect, it } from 'vitest'
import {
  messageAttachmentEndpoint,
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

  it('resolves a backend storage path to the server file URL', () => {
    expect(messageAttachmentUrl({ path: 'messages/channel-1/photo.jpg' })).toBe(
      'http://10.0.105.90:8000/storage/messages/channel-1/photo.jpg',
    )
    expect(messageAttachmentUrl({ path: 'storage/messages/channel-1/photo.jpg' })).toBe(
      'http://10.0.105.90:8000/storage/messages/channel-1/photo.jpg',
    )
  })

  it('prefers a backend-provided file URL', () => {
    expect(messageAttachmentUrl({ path: 'ignored.jpg', file_url: '/files/photo.jpg' })).toBe(
      'http://10.0.105.90:8000/files/photo.jpg',
    )
  })

  it('accepts a backend-provided attachment URL', () => {
    expect(messageAttachmentUrl({ attachment_url: 'https://cdn.example.com/photo.jpg' })).toBe(
      'https://cdn.example.com/photo.jpg',
    )
  })

  it('ignores browser blob URLs and falls back to the backend storage path', () => {
    expect(
      messageAttachmentUrl({
        url: 'blob:http://localhost:5173/ade47f67-984a-4a2f-98fe-d42f270b7c10',
        localPreviewUrl: 'blob:http://localhost:5173/ade47f67-984a-4a2f-98fe-d42f270b7c10',
        path: 'messages/channel-1/photo.jpg',
      }),
    ).toBe('http://10.0.105.90:8000/storage/messages/channel-1/photo.jpg')
  })

  it('does not return a blob URL as a server attachment URL', () => {
    expect(messageAttachmentUrl({ url: 'blob:http://localhost:5173/file-1' })).toBe('')
  })

  it('builds the channel message attachment endpoint', () => {
    expect(
      messageAttachmentEndpoint(
        { id: 'attachment-1' },
        {
          conversationType: 'channel',
          companyId: 'company-1',
          teamId: 'team-1',
          channelId: 'channel-1',
          messageId: 'message-1',
        },
      ),
    ).toBe(
      '/v1/company-1/teams/team-1/channels/channel-1/messages/message-1/attachments/attachment-1',
    )
  })

  it('builds the direct channel message attachment endpoint', () => {
    expect(
      messageAttachmentEndpoint(
        { attachment_id: 'attachment-1' },
        {
          conversationType: 'dm',
          companyId: 'company-1',
          channelId: 'dm-1',
          messageId: 'message-1',
        },
      ),
    ).toBe('/v1/company-1/direct-channels/dm-1/messages/message-1/attachments/attachment-1')
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
