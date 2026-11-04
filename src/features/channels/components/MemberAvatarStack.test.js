import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberAvatarStack from './MemberAvatarStack.vue'

describe('MemberAvatarStack', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a profile preview when hovering a member avatar', async () => {
    const wrapper = mount(MemberAvatarStack, {
      props: {
        members: [
          { id: '1', name: 'Abbas Ali', status: 'offline', email: 'abbas.alicm@pf.com.pk' },
        ],
        total: 1,
        max: 3,
      },
    })

    const avatar = wrapper.find('.ch-stack__avatar')
    await avatar.trigger('mouseenter')
    await avatar.trigger('mouseleave')
    await avatar.trigger('mouseenter')

    expect(wrapper.find('.ch-stack__preview').exists()).toBe(true)
    expect(wrapper.text()).toContain('Abbas Ali')
    expect(wrapper.text()).toContain('abbas.alicm@pf.com.pk')
  })

  it('keeps the profile preview open while moving the pointer onto it', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MemberAvatarStack, {
      props: {
        members: [{ id: '1', name: 'Abbas Ali', status: 'offline' }],
        total: 1,
      },
    })

    await wrapper.find('.ch-stack__avatar').trigger('mouseenter')
    await wrapper.trigger('mouseleave')
    await wrapper.find('.ch-stack__preview').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)

    expect(wrapper.find('.ch-stack__preview').exists()).toBe(true)
    wrapper.unmount()
  })
})
