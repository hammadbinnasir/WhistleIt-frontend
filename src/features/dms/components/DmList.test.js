import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'
import DmList from './DmList.vue'
import DmListItem from './DmListItem.vue'

describe('DmList', () => {
  beforeEach(() => setActivePinia(createPinia()))

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
})
