import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import MemberManageModal from './MemberManageModal.vue'
import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

describe('MemberManageModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows a quick profile preview when hovering a member row', async () => {
    const ui = useUiStore()
    const teamsStore = useTeamsStore()
    const membersStore = useMembersStore()

    teamsStore.$state.activeTeam = { id: 'team-1', name: 'Design Team' }
    membersStore.members = [
      {
        id: 'm-1',
        name: 'Abbas Ali',
        email: 'abbas.alicm@pf.com.pk',
        role: 'member',
        status: 'offline',
      },
    ]
    ui.memberManageModalOpen = true

    const wrapper = mount(MemberManageModal)
    const row = wrapper.find('.member-row')

    await row.trigger('mouseenter')
    await nextTick()

    expect(wrapper.find('.member-hover-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Abbas Ali')
    expect(wrapper.text()).toContain('abbas.alicm@pf.com.pk')
  })

  it('shows the read-only backend state without add or remove controls', () => {
    const ui = useUiStore()
    const membersStore = useMembersStore()
    membersStore.members = [{ id: 'member-1', name: 'Member', role: 'member' }]
    ui.memberManageModalOpen = true

    const wrapper = mount(MemberManageModal)

    expect(wrapper.text()).toContain('read-only for now')
    expect(wrapper.text()).toContain('Adding and removing members is not available yet')
    expect(wrapper.text()).not.toContain('Add Member')
    expect(wrapper.find('.remove-btn').exists()).toBe(false)
  })
})
