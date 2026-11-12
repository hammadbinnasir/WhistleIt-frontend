import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetUserStore, useUserStore } from '@/features/account/composables/useUserStore'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import DmListItem from './DmListItem.vue'

describe('DmListItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetUserStore()
  })

  it('shows a peer custom-status emoji with only the status text in its tooltip', async () => {
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
    expect(wrapper.get('[data-test="dm-row"]').attributes('title')).toBeUndefined()
    await statusEmoji.trigger('mouseenter')
    expect(document.body.querySelector('[role="tooltip"]').textContent).toBe('In a meeting')
    expect(wrapper.get('.rounded-full').classes()).toContain('group-hover:invisible')
    expect(document.body.querySelector('[role="tooltip"]').className).toContain('fixed')
    wrapper.unmount()
  })

  it('immediately replaces a cached peer status with the latest live status', async () => {
    const dms = useDmStore()
    dms.meId = 'me'
    dms.usersById.peer = {
      name: 'Alex',
      customStatus: { emoji: '📅', text: 'Old status' },
    }
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const wrapper = mount(DmListItem, {
      props: {
        conversation: {
          id: 'conversation-live-status',
          type: 'dm',
          members: ['me', 'peer'],
          unreadCount: 0,
        },
        active: false,
      },
    })

    await wrapper.get('[role="img"]').trigger('mouseenter')
    expect(document.body.querySelector('[role="tooltip"]').textContent).toBe('Old status')

    usePresenceStore().presenceById.peer = {
      state: 'online',
      status: { emoji: '🚌', text: 'Commuting', expiresAt },
    }
    await nextTick()

    expect(wrapper.get('[role="img"]').element.firstChild.textContent.trim()).toBe('🚌')
    expect(document.body.querySelector('[role="tooltip"]').textContent).toMatch(
      /^Commuting \(Expires at .+, .+\)$/,
    )
    expect(document.body.querySelector('[role="tooltip"]').textContent).not.toContain('Old status')
  })

  it('hides a cleared peer status even when a stale live value remains', async () => {
    const dms = useDmStore()
    dms.meId = 'me'
    dms.usersById.peer = {
      name: 'Alex',
      customStatus: null,
      customStatusLoaded: true,
    }
    usePresenceStore().presenceById.peer = {
      state: 'online',
      status: { emoji: '📅', text: 'Old status' },
    }
    const wrapper = mount(DmListItem, {
      props: {
        conversation: {
          id: 'conversation-cleared-status',
          type: 'dm',
          members: ['me', 'peer'],
          unreadCount: 0,
        },
        active: false,
      },
    })

    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the current user emoji and expiry on a status-only row without an ID', async () => {
    const dms = useDmStore()
    dms.meId = ''
    const wrapper = mount(DmListItem, {
      props: {
        statusOnly: true,
        conversation: {
          id: 'my-custom-status',
          type: 'dm',
          members: [''],
          name: 'Hammad Kazmi',
          customStatus: {
            emoji: '🚌',
            text: 'Commuting',
            expiresAt: Date.now() + 60_000,
          },
          unreadCount: 0,
          messages: [],
        },
        active: false,
      },
    })

    expect(wrapper.get('[role="img"]').element.firstChild.textContent.trim()).toBe('🚌')
    await wrapper.get('[role="img"]').trigger('mouseenter')
    expect(document.body.querySelector('[role="tooltip"]').textContent).toMatch(
      /^Commuting \(Expires at .+, .+\)$/,
    )
    expect(wrapper.find('button[aria-label="Close conversation"]').exists()).toBe(false)
  })

})
