import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDmStore } from '@/features/dms/stores/dms'
import ComposerConversation from './ComposerConversation.vue'
import MessageComposer from './MessageComposer.vue'

describe('composer conversation', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows a sent message in the conversation', async () => {
    const wrapper = mount(ComposerConversation)

    const editor = wrapper.get('[contenteditable="true"]')

    editor.element.textContent = 'Hello team'

    editor.element.dispatchEvent(new Event('input', { bubbles: true }))

    await nextTick()

    const composer = wrapper.findComponent(MessageComposer)

    expect(composer.get('button[aria-label="Send message"]').attributes('disabled')).toBeUndefined()

    await composer.get('form').trigger('submit')

    expect(wrapper.text()).toContain('You')

    expect(wrapper.text()).toContain('Hello team')

    expect(wrapper.text()).toContain('just now')

    expect(wrapper.get('[aria-label="Sent"]').text()).toBe('✓✓')
  })

  it('opens and sends messages in the selected direct message', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = dms.startDm('u2')
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })

    expect(wrapper.text()).toContain('Project ideas bhej di hain')

    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.textContent = 'Reply from the composer'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await wrapper.get('form').trigger('submit')

    expect(conversation.messages.at(-1)).toMatchObject({
      from: dms.meId,
      text: 'Reply from the composer',
    })
    expect(wrapper.text()).toContain('Reply from the composer')
  })

  it('shows scheduled message time and timezone in the conversation', async () => {
    const wrapper = mount(ComposerConversation)

    const editor = wrapper.get('[contenteditable="true"]')

    editor.element.textContent = 'Reminder'

    editor.element.dispatchEvent(new Event('input', { bubbles: true }))

    await nextTick()

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('.message-composer__schedule-choice').trigger('click')

    expect(wrapper.text()).toContain('Reminder')

    expect(wrapper.text()).toContain('Scheduled for')

    expect(wrapper.text()).toContain('Asia/Karachi')
  })
})
