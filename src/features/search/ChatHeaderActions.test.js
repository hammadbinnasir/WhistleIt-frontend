import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '@/stores/ui'
import ChatHeaderActions from './ChatHeaderActions.vue'

describe('chat header pinned messages', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the pin action only for the current conversation', () => {
    const ui = useUiStore()
    ui.togglePinnedMessage(
      { id: 'pinned-1', content: 'Muniba message' },
      { id: 'c1', name: 'Muniba Naseer', type: 'dm' },
    )

    const otherChat = mount(ChatHeaderActions, {
      props: { isDm: true, conversationId: 'c2' },
    })
    expect(otherChat.find('[aria-label="Pinned messages"]').exists()).toBe(false)

    const munibaChat = mount(ChatHeaderActions, {
      props: { isDm: true, conversationId: 'c1' },
    })
    expect(munibaChat.find('[aria-label="Pinned messages"]').exists()).toBe(true)
  })
})
