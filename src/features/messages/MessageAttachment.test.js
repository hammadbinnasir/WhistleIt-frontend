import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/channels/api/http', () => ({
  http: httpMock,
}))

import MessageAttachment from './MessageAttachment.vue'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

describe('MessageAttachment', () => {
  beforeEach(() => {
    httpMock.mockReset()
    URL.createObjectURL = vi.fn().mockReturnValue('blob:attachment-preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL
    else delete URL.createObjectURL
    if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL
    else delete URL.revokeObjectURL
  })

  it('loads images through the authenticated API client and displays the blob preview', async () => {
    httpMock.mockResolvedValue(new Blob(['image-data'], { type: 'image/jpeg' }))
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'photo.jpg', path: 'messages/channel-1/photo.jpg' },
      },
    })
    await flushPromises()

    expect(httpMock).toHaveBeenCalledWith(
      'http://10.0.105.90:8000/storage/messages/channel-1/photo.jpg',
      { responseType: 'blob' },
    )
    expect(wrapper.get('img').attributes('src')).toBe('blob:attachment-preview')
    expect(wrapper.get('a').attributes('href')).toBe('blob:attachment-preview')
    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview')
  })

  it('shows document details with open and download links', async () => {
    httpMock.mockResolvedValue(new Blob(['pdf-data'], { type: 'application/pdf' }))
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'report.pdf', path: 'messages/channel-1/report.pdf', size: 2048 },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('PDF')
    expect(wrapper.text()).toContain('report.pdf')
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      'blob:attachment-preview',
      'blob:attachment-preview',
    ])
    expect(wrapper.get('[download="report.pdf"]').exists()).toBe(true)
  })

  it('shows an explicit retryable error when the authenticated file request fails', async () => {
    httpMock.mockRejectedValue(new Error('Forbidden'))
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'report.pdf', path: 'messages/channel-1/report.pdf' },
      },
    })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Forbidden')
    expect(wrapper.get('button').text()).toBe('Retry')
    expect(httpMock).toHaveBeenCalledTimes(1)
  })

  it('explains when a browser network or CORS failure blocks the file request', async () => {
    httpMock.mockRejectedValue({ message: 'Failed to fetch', status: 0 })
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'photo.jpg', path: 'messages/channel-1/photo.jpg' },
      },
    })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'allow CORS for authenticated /storage requests',
    )
    expect(wrapper.get('button').text()).toBe('Retry')
  })
})
