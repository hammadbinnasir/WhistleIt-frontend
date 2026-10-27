import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HelpMedia from './HelpMedia.vue'

describe('HelpMedia', () => {
  it('renders the image when the media entry has a url', () => {
    const wrapper = mount(HelpMedia, {
      props: { media: { name: null, url: 'https://example.com/a.gif' }, alt: 'Demo' },
    })

    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe('https://example.com/a.gif')
    expect(img.attributes('alt')).toBe('Demo')
  })

  it('shows the slot content when there is no image', () => {
    const wrapper = mount(HelpMedia, {
      props: { media: { name: 'missing', url: null } },
      slots: { default: '<span data-testid="fallback">built-in art</span>' },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[data-testid="fallback"]').text()).toBe('built-in art')
  })

  it('falls back to the slot content when the image fails to load', async () => {
    const wrapper = mount(HelpMedia, {
      props: { media: { name: null, url: 'https://example.com/broken.gif' } },
      slots: { default: '<span data-testid="fallback">built-in art</span>' },
    })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fallback"]').exists()).toBe(true)
  })

  it('names the expected file in a dev placeholder when there is no slot', () => {
    const wrapper = mount(HelpMedia, {
      props: { media: { name: 'missing-help-image', url: null } },
    })

    const placeholder = wrapper.get('[data-testid="help-media-placeholder"]')
    expect(placeholder.text()).toContain('missing-help-image')
  })
})
