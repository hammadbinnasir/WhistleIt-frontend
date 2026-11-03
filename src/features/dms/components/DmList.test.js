import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import DmList from './DmList.vue'
import DmListItem from './DmListItem.vue'

describe('DmList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
  })

  it('closes the activity panel and clears channel selection when a DM is selected', async () => {
    const dms = useDmStore()
    await dms.init()
    const ui = useUiStore()
    ui.selectChannel('general')
    ui.activePanel = 'activity'

    const wrapper = shallowMount(DmList)
    wrapper.findComponent(DmListItem).vm.$emit('select', 'c1')

    expect(dms.activeId).toBe('c1')
    expect(ui.selectedChannelId).toBeNull()
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('loads company members when the new-message button is clicked', async () => {
    const teams = useTeamsStore()
    teams.teamsByWorkspaceId = { 'company-1': [] }
    const listMembers = vi.spyOn(dmApi, 'listCompanyMembers').mockResolvedValue([])
    const wrapper = shallowMount(DmList)

    await wrapper.find('button[title="New message"]').trigger('click')

    await vi.waitFor(() => {
      expect(listMembers).toHaveBeenCalledWith('company-1')
    })
    wrapper.unmount()
    listMembers.mockRestore()
  })
})
