import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MessageAttachment from './MessageAttachment.vue'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

describe('MessageAttachment', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:attachment-preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL
    else delete URL.createObjectURL
    if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL
    else delete URL.revokeObjectURL
  })

  it('renders the URL returned by the API directly', () => {
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'photo.jpg', file_url: 'https://cdn.example.com/photo.jpg' },
      },
    })

    expect(wrapper.get('img').attributes('src')).toBe('https://cdn.example.com/photo.jpg')
    expect(wrapper.get('.message-attachment__name').text()).toContain('photo.jpg')
    expect(wrapper.get('[download="photo.jpg"]').attributes('href')).toBe(
      'https://cdn.example.com/photo.jpg',
    )
  })

  it('renders images from paths returned by the messages API', () => {
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'men.jpg', path: 'messages/6aedba81/6af2d316.jpg' },
      },
    })

    expect(wrapper.get('img').attributes('src')).toBe(
      'http://10.0.105.90:8000/storage/messages/6aedba81/6af2d316.jpg',
    )
  })

  it('shows only the download action for files', () => {
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: {
          name: 'report.pdf',
          download_url: 'https://cdn.example.com/report.pdf',
          size: 2048,
        },
      },
    })

    expect(wrapper.find('[aria-label="More attachment actions"]').exists()).toBe(false)
    expect(wrapper.get('a[aria-label="Download report.pdf"]').attributes('download')).toBe(
      'report.pdf',
    )
  })

  it('shows document details with open and download links', () => {
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: {
          name: 'report.pdf',
          download_url: 'https://cdn.example.com/report.pdf',
          size: 2048,
        },
      },
    })

    expect(wrapper.text()).toContain('PDF')
    expect(wrapper.text()).toContain('report.pdf')
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      'https://cdn.example.com/report.pdf',
    ])
    expect(wrapper.get('.message-attachment__name').text()).toContain('1 File')
    expect(wrapper.get('[download="report.pdf"]').exists()).toBe(true)
  })

  it('shows an explicit error when the API did not return a file URL or path', () => {
    const wrapper = mount(MessageAttachment, {
      props: {
        attachment: { name: 'report.pdf' },
      },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('The server did not provide a file URL.')
  })
})
