import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/features/channels/api/http'
import MessageAttachment from './MessageAttachment.vue'

vi.mock('@/features/channels/api/http', () => ({
  http: vi.fn(),
}))

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const mountAttachment = (attachment, context = {}) =>
  mount(MessageAttachment, {
    props: {
      attachment,
      conversationType: 'channel',
      companyId: 'company-1',
      teamId: 'team-1',
      channelId: 'channel-1',
      messageId: 'message-1',
      ...context,
    },
  })

describe('MessageAttachment', () => {
  beforeEach(() => {
    sessionStorage.clear()
    http.mockReset().mockResolvedValue(new Blob(['file']))
    URL.createObjectURL = vi.fn().mockReturnValue('blob:attachment-preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL
    else delete URL.createObjectURL
    if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL
    else delete URL.revokeObjectURL
  })

  it('fetches a channel attachment from its message attachment endpoint', async () => {
    sessionStorage.setItem('rememberToken', 'remember-token')
    const wrapper = mountAttachment({
      id: 'attachment-1',
      name: 'photo.jpg',
      file_url: 'https://cdn.example.com/photo.jpg',
    })

    await flushPromises()

    expect(http).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-1/channels/channel-1/messages/message-1/attachments/attachment-1',
      expect.objectContaining({
        responseType: 'blob',
        headers: { 'ex-remember-token': 'remember-token' },
      }),
    )
    expect(wrapper.get('img').attributes('src')).toBe('blob:attachment-preview')
    expect(wrapper.get('.message-attachment__name').text()).toContain('photo.jpg')
    expect(wrapper.get('[download="photo.jpg"]').attributes('href')).toBe('blob:attachment-preview')
  })

  it('keeps a local preview while a new attachment is being sent', async () => {
    const wrapper = mountAttachment({
      name: 'photo.jpg',
      localPreviewUrl: 'blob:http://localhost:5173/local-preview',
    })

    await flushPromises()

    expect(wrapper.get('img').attributes('src')).toBe('blob:http://localhost:5173/local-preview')
    expect(http).not.toHaveBeenCalled()
  })

  it('fetches a direct attachment from the DM endpoint without requiring a team ID', async () => {
    sessionStorage.setItem('rememberToken', 'remember-token')
    const wrapper = mountAttachment(
      { id: 'attachment-2', name: 'men.jpg', path: 'messages/6aedba81/6af2d316.jpg' },
      {
        conversationType: 'dm',
        teamId: null,
        channelId: 'dm-channel',
        messageId: 'dm-message',
      },
    )

    await flushPromises()

    expect(http).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/dm-channel/messages/dm-message/attachments/attachment-2',
      expect.objectContaining({
        responseType: 'blob',
        headers: { 'ex-remember-token': 'remember-token' },
      }),
    )
    expect(wrapper.get('img').attributes('src')).toBe('blob:attachment-preview')
  })

  it('encodes message and attachment IDs for the endpoint', async () => {
    mountAttachment(
      { id: 'file/3', name: 'men.jpg' },
      { channelId: 'channel/1', messageId: 'message/2' },
    )

    await flushPromises()

    expect(http).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-1/channels/channel%2F1/messages/message%2F2/attachments/file%2F3',
      expect.objectContaining({ responseType: 'blob' }),
    )
  })

  it('shows only the download action for files', async () => {
    const wrapper = mountAttachment({
      id: 'attachment-3',
      name: 'report.pdf',
      download_url: 'https://cdn.example.com/report.pdf',
      size: 2048,
    })

    await flushPromises()
    expect(wrapper.find('[aria-label="More attachment actions"]').exists()).toBe(false)
    expect(wrapper.get('a[aria-label="Download report.pdf"]').attributes('download')).toBe(
      'report.pdf',
    )
  })

  it('shows document details with blob-backed open and download links', async () => {
    const wrapper = mountAttachment({
      id: 'attachment-4',
      name: 'report.pdf',
      download_url: 'https://cdn.example.com/report.pdf',
      size: 2048,
    })

    await flushPromises()
    expect(wrapper.text()).toContain('PDF')
    expect(wrapper.text()).toContain('report.pdf')
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      'blob:attachment-preview',
    ])
    expect(wrapper.get('.message-attachment__name').text()).toContain('1 File')
    expect(wrapper.get('[download="report.pdf"]').exists()).toBe(true)
  })

  it('shows an explicit error when the attachment or message ID is missing', async () => {
    const wrapper = mountAttachment({ name: 'report.pdf' })

    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'The attachment is missing its message or file ID.',
    )
    expect(http).not.toHaveBeenCalled()
  })

  it('shows authenticated download errors instead of rendering the backend URL', async () => {
    http.mockRejectedValue(new Error('Forbidden'))
    const wrapper = mountAttachment({
      id: 'attachment-5',
      name: 'report.pdf',
      path: 'messages/channel-1/report.pdf',
    })

    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Forbidden')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
