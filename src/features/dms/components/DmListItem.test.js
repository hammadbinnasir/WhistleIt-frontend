import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import { usePresenceStore } from '@/features/dms/stores/presence'
import DmListItem from './DmListItem.vue'

describe('DmListItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
  })

  it('does not show custom presence text or emoji', async () => {
    const dms = useDmStore()
    await dms.init()
    const presence = usePresenceStore()
    presence.presenceById.u2 = {
      state: 'offline',
      status: { emoji: '🌴', text: 'On leave' },
    }

    const wrapper = mount(DmListItem, {
      props: { conversation: dms.conversations.find(({ id }) => id === 'c1') },
    })

    expect(wrapper.text()).toContain('Muniba Naseer')
    expect(wrapper.text()).not.toContain('On leave')
    expect(wrapper.text()).not.toContain('🌴')
    expect(wrapper.get('button').attributes('title')).toBe('Offline')
  })
})
