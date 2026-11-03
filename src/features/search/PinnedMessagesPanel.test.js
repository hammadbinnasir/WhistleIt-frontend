import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '@/stores/ui'
import PinnedMessagesPanel from './PinnedMessagesPanel.vue'

describe('pinned messages panel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows only messages pinned in the current conversation', () => {
    const ui = useUiStore()
    ui.togglePinnedMessage(
      { id: 'pinned-1', content: 'Muniba pinned message' },
      { id: 'c1', name: 'Muniba Naseer' },
    )
    ui.togglePinnedMessage(
      { id: 'pinned-2', content: 'Another chat pinned message' },
      { id: 'c2', name: 'Ali Umais' },
    )

    const wrapper = mount(PinnedMessagesPanel, {
      props: { conversationId: 'c1' },
    })

    expect(wrapper.text()).toContain('Muniba pinned message')
    expect(wrapper.text()).not.toContain('Another chat pinned message')
    expect(wrapper.text()).toContain('Muniba Naseer')
  })
})
