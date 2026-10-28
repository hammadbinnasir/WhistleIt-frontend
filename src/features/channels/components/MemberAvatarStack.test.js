import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberAvatarStack from './MemberAvatarStack.vue'

describe('MemberAvatarStack', () => {
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
})
