import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import { downloadRecentFile, listRecentFiles } from './recentFilesApi'

vi.mock('@/features/channels/api/http', () => ({ http: vi.fn() }))

describe('recent files API', () => {
  beforeEach(() => {
    http.mockReset()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('gets recent files with only company_id as a query parameter', async () => {
    const files = [{ id: 'file-1', name: 'report.pdf' }]
    http.mockResolvedValue({ success: true, data: { files } })

    await expect(listRecentFiles('company-1')).resolves.toEqual(files)
    expect(http).toHaveBeenCalledOnce()
    expect(http).toHaveBeenCalledWith('/v1/files/recent', {
      method: 'GET',
      params: { company_id: 'company-1' },
    })
  })

  it('removes duplicate recent files by name and MIME type, keeping the newest entry', async () => {
    const files = [
      {
        id: 'file-old',
        name: 'photo.png',
        mime_type: 'image/png',
        path: 'messages/channel-1/photo-old.png',
        created_at: '2026-11-11T09:00:00Z',
      },
      {
        id: 'file-new',
        name: ' Photo.png ',
        mime_type: 'image/png',
        path: 'messages/channel-2/photo-new.png',
        created_at: '2026-11-12T09:00:00Z',
      },
      {
        id: 'file-pdf',
        name: 'photo.png',
        mime_type: 'application/pdf',
        path: 'messages/channel-3/photo.png',
        created_at: '2026-11-12T09:30:00Z',
      },
    ]
    http.mockResolvedValue({ success: true, data: { files } })

    await expect(listRecentFiles('company-1')).resolves.toEqual([files[1], files[2]])
  })

  it('rejects missing company IDs before making a request', async () => {
    await expect(listRecentFiles('')).rejects.toThrow(
      'A company ID is required to load recent files.',
    )
    expect(http).not.toHaveBeenCalled()
  })

  it('reports an invalid response instead of silently showing an empty list', async () => {
    http.mockResolvedValue({ success: true, data: { items: [] } })

    await expect(listRecentFiles('company-1')).rejects.toThrow(
      'The recent files response does not contain a file list.',
    )
  })

  it('downloads from the channel attachment endpoint and preserves file metadata', async () => {
    const blob = new Blob(['pdf bytes'], { type: 'application/octet-stream' })
    const recentFile = {
      id: 'attachment-1',
      company_id: 'company-1',
      team_id: 'team-1',
      channel_id: 'channel-1',
      message_id: 'message-1',
      conversation_type: 'channel',
      name: 'report.pdf',
      mime_type: 'application/pdf',
      downloadUrl: 'https://files.example.test/report.pdf',
    }
    http.mockResolvedValue(blob)

    const file = await downloadRecentFile(recentFile, {
      companyId: 'company-1',
    })

    expect(http).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-1/channels/channel-1/messages/message-1/attachments/attachment-1',
      { responseType: 'blob' },
    )
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('report.pdf')
    expect(file.type).toBe('application/pdf')
    await expect(file.text()).resolves.toBe('pdf bytes')
  })

  it('downloads a recent direct-message file from its source message endpoint', async () => {
    http.mockResolvedValue(new Blob(['image bytes'], { type: 'image/jpeg' }))

    await downloadRecentFile(
      {
        id: 'attachment-2',
        message_id: 'dm-message',
        direct_channel_id: 'dm-channel',
        company_id: 'company-1',
        conversation_type: 'dm',
        name: 'photo.jpg',
      },
      { companyId: 'active-company' },
    )

    expect(http).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/dm-channel/messages/dm-message/attachments/attachment-2',
      { responseType: 'blob' },
    )
  })

  it('uses the source channel identifiers from each recent file record', async () => {
    http.mockResolvedValue(new Blob(['image bytes'], { type: 'image/jpeg' }))

    await downloadRecentFile(
      {
        file_id: 'attachment-3',
        message_id: 'source-message',
        company_id: 'source-company',
        team_id: 'source-team',
        channel_id: 'source-channel',
        conversation_type: 'channel',
        name: 'photo.jpg',
      },
      { companyId: 'active-company' },
    )

    expect(http).toHaveBeenCalledWith(
      '/v1/source-company/teams/source-team/channels/source-channel/messages/source-message/attachments/attachment-3',
      { responseType: 'blob' },
    )
  })

  it('builds the channel attachment request from the recent-file storage path', async () => {
    http.mockResolvedValue(new Blob(['image bytes'], { type: 'image/png' }))

    await downloadRecentFile(
      {
        id: 'attachment-4',
        message_id: 'message-4',
        company_id: 'company-1',
        name: 'image.png',
        path: 'messages/channel-4/message-4/image.png',
      },
      { companyId: 'company-1', teamId: 'team-4' },
    )

    expect(http).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-4/channels/channel-4/messages/message-4/attachments/attachment-4',
      { responseType: 'blob' },
    )
  })

  it('tries the direct-channel attachment endpoint when an untyped recent file is not in a team channel', async () => {
    http.mockRejectedValueOnce({ status: 404, message: 'Not found' })
    http.mockResolvedValueOnce(new Blob(['image bytes'], { type: 'image/png' }))

    await downloadRecentFile(
      {
        id: 'attachment-5',
        message_id: 'message-5',
        company_id: 'company-1',
        name: 'image.png',
        path: 'messages/direct-channel-5/message-5/image.png',
      },
      { companyId: 'company-1', teamId: 'team-1' },
    )

    expect(http).toHaveBeenNthCalledWith(
      1,
      '/v1/company-1/teams/team-1/channels/direct-channel-5/messages/message-5/attachments/attachment-5',
      { responseType: 'blob' },
    )
    expect(http).toHaveBeenNthCalledWith(
      2,
      '/v1/company-1/direct-channels/direct-channel-5/messages/message-5/attachments/attachment-5',
      { responseType: 'blob' },
    )
  })

  it('requires source attachment IDs instead of falling back to a storage URL', async () => {
    await expect(
      downloadRecentFile(
        {
          id: 'attachment-1',
          name: 'report.pdf',
          path: 'messages/report.pdf',
          download_url: 'https://files.example.test/report.pdf',
        },
        {
          companyId: 'company-1',
          teamId: 'active-team',
          channelId: 'active-channel',
          conversationType: 'channel',
        },
      ),
    ).rejects.toThrow('The attachment is missing its message or file ID.')
    expect(http).not.toHaveBeenCalled()
  })
})
