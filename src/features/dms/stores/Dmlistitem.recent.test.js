import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import DmListItem from '../components/DmListItem.vue'

describe('DmListItem: recent sync indicator', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const conversation = { id: 'c1', type: 'dm', members: ['u1', 'u2'], name: '', unreadCount: 0, messages: [] }

  it.each([
    ['saving', 'Syncing…'],
    ['pending', 'Will sync when the connection is back'],
    ['error', 'Open the conversation again to retry'],
  ])('shows %s', async (status, title) => {
    const dms = useDmStore()
    dms.recentSync = { c1: status }
    const wrapper = mount(DmListItem, { props: { conversation } })
    expect(wrapper.get(`[data-test="recent-${status}"]`).attributes('title')).toContain(title)
  })

  it('shows nothing once synced', () => {
    const wrapper = mount(DmListItem, { props: { conversation } })
    expect(wrapper.find('[data-test^="recent-"]').exists()).toBe(false)
  })
})