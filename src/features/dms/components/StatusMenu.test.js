import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import StatusMenu from './StatusMenu.vue'

describe('StatusMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
  })

  it('offers presence states without custom status controls', async () => {
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(StatusMenu)
    await wrapper.get('button').trigger('click')

    expect(wrapper.text()).toContain('Online')
    expect(wrapper.text()).toContain('Away')
    expect(wrapper.text()).toContain('Offline')
    expect(wrapper.text()).not.toContain('On leave')
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
