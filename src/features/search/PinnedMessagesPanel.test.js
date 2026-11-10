import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useChannelsStore } from '@/features/channels'
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'
import PinnedMessagesPanel from './PinnedMessagesPanel.vue'

describe('pinned messages panel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows the channel name in the heading and formats pinned channel messages', () => {
    useChannelsStore().upsertChannel({ id: 'my-channel', name: 'My Channel' })
    useUiStore().togglePinnedMessage(
      {
        id: 'channel-pin',
        author: 'Salman Zahoor',
        content: 'Important channel message',
        createdAt: '2026-11-06T10:00:00Z',
      },
      { id: 'my-channel', name: 'My Channel', kind: 'public' },
    )

    const wrapper = mount(PinnedMessagesPanel, {
      props: { conversationId: 'my-channel', conversationType: 'channel' },
    })

    expect(wrapper.get('h2').text()).toBe('Pinned Messages In My Channel')
    expect(wrapper.text()).toContain('Salman Zahoor')
    expect(wrapper.text()).toContain('PINNED')
    expect(wrapper.text()).toContain('Important channel message')
    expect(wrapper.get('li p').classes()).toContain('bg-slate-100')
    wrapper.unmount()
  })

  it('shows the DM partner in the heading and links pinned DM URLs', () => {
    const dms = useDmStore()
    dms.meId = 'current-user'
    dms.usersById = { partner: { id: 'partner', name: 'Muniba Naseer' } }
    dms.conversations.push({
      id: 'direct-channel',
      type: 'dm',
      members: ['current-user', 'partner'],
    })
    useUiStore().togglePinnedMessage(
      {
        id: 'dm-pin',
        author: 'Muniba Naseer',
        content: 'http://10.0.105.98:5173/',
        createdAt: '2026-11-10T10:00:00Z',
      },
      { id: 'direct-channel', name: 'Muniba Naseer', type: 'dm' },
    )

    const wrapper = mount(PinnedMessagesPanel, {
      props: { conversationId: 'direct-channel', conversationType: 'dm' },
    })

    expect(wrapper.get('h2').text()).toBe('Pinned Messages With Muniba Naseer')
    expect(wrapper.get('li a').attributes('href')).toBe('http://10.0.105.98:5173/')
    expect(wrapper.get('li p').classes()).not.toContain('bg-slate-100')
    wrapper.unmount()
  })
})
