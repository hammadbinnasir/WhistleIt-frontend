import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import NewDmPanel from './NewDmPanel.vue'

describe('NewDmPanel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows available member names when the dropdown arrow is clicked', async () => {
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await document.body.querySelector('[aria-label="Show members"]').click()
    await wrapper.vm.$nextTick()

    const options = document.body.querySelectorAll('li button')
    expect([...options].map((option) => option.textContent)).toEqual([
      expect.stringContaining('Muniba Naseer'),
      expect.stringContaining('Ali Umais'),
      expect.stringContaining('Salman Zahoor'),
      expect.stringContaining('Muhammad Ahmad'),
      expect.stringContaining('Esha Fayyaz'),
      expect.stringContaining('Taha Jawad'),
      expect.stringContaining('Syed Mukarram Ali'),
    ])
    expect(document.body.textContent).not.toContain('Aiman Iqbal')

    wrapper.unmount()
  })
})
