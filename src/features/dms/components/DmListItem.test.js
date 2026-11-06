import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetUserStore, useUserStore } from '@/features/account/composables/useUserStore'
import { useDmStore } from '@/features/dms/stores/dms'
import DmListItem from './DmListItem.vue'

describe('DmListItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetUserStore()
  })

  it('shows a peer custom-status emoji with only the status text in its tooltip', () => {
    const dms = useDmStore()
    dms.meId = 'me'
    dms.usersById.peer = {
      name: 'Alex',
      customStatus: { emoji: '📅', text: 'In a meeting' },
    }
    useUserStore().hydrate({
      customStatus: 'My status',
      customStatusEmoji: '🎧',
      customStatusExpiresAt: Date.now() + 60_000,
    })

    const wrapper = mount(DmListItem, {
      props: {
        conversation: {
          id: 'conversation-1',
          type: 'dm',
          members: ['me', 'peer'],
          unreadCount: 2,
        },
        active: false,
      },
    })

    const statusEmoji = wrapper.get('[role="img"]')
    expect(statusEmoji.element.firstChild.textContent.trim()).toBe('📅')
    expect(statusEmoji.attributes('aria-label')).toBe('Custom status: In a meeting')
    expect(wrapper.get('[role="tooltip"]').text()).toBe('In a meeting')
    expect(wrapper.get('.rounded-full').classes()).toContain('group-hover:invisible')
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('group-hover/status:opacity-100')
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('top-full')
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('right-0')
  })
})
