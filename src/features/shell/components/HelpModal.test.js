import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import { useUiStore } from '@/stores/ui'
import HelpModal from './HelpModal.vue'

function mountHelpModal() {
  const pinia = createPinia()
  const wrapper = mount(HelpModal, {
    global: { plugins: [pinia], stubs: { teleport: true } },
  })
  return { wrapper, ui: useUiStore(pinia) }
}

describe('HelpModal', () => {
  it('shows the help drawer when opened from the UI store', async () => {
    const { wrapper, ui } = mountHelpModal()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    ui.toggleHelpModal()
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Find answers quickly')
  })

  it('closes the drawer when the backdrop is clicked', async () => {
    const { wrapper, ui } = mountHelpModal()
    ui.toggleHelpModal()
    await nextTick()

    await wrapper.get('[data-testid="help-backdrop"]').trigger('click')

    expect(ui.helpModalOpen).toBe(false)
  })

  it('closes the drawer from its header close button', async () => {
    const { wrapper, ui } = mountHelpModal()
    ui.toggleHelpModal()
    await nextTick()

    await wrapper.get('button[aria-label="Close Help"]').trigger('click')

    expect(ui.helpModalOpen).toBe(false)
  })

  it('closes the drawer with Escape when no nested dialog is open', async () => {
    const { ui } = mountHelpModal()
    ui.toggleHelpModal()
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(ui.helpModalOpen).toBe(false)
  })
})
