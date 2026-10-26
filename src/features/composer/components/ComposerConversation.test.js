import { mount } from '@vue/test-utils'

import { nextTick } from 'vue'

import { describe, expect, it, vi } from 'vitest'

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      setup() {
        return () => h('div')
      },
    }),
  }
})

import ComposerConversation from './ComposerConversation.vue'

import MessageComposer from './MessageComposer.vue'



describe('composer conversation', () => {

  it('shows a sent message in the conversation', async () => {

    const wrapper = mount(ComposerConversation)

    const editor = wrapper.get('[contenteditable="true"]')

    editor.element.textContent = 'Hello team'

    editor.element.dispatchEvent(new Event('input', { bubbles: true }))

    await nextTick()

    const composer = wrapper.findComponent(MessageComposer)

    expect(composer.get('button[aria-label="Send message"]').attributes('disabled')).toBeUndefined()

    await composer.get('form').trigger('submit')



    expect(wrapper.text()).toContain('Ali Umais')

    expect(wrapper.text()).toContain('Hello team')

    expect(wrapper.text()).toContain('just now')

    expect(wrapper.get('[aria-label="Sent"]').text()).toBe('✓✓')

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

  it('shows a selected GIF as a conversation message', async () => {
    const wrapper = mount(ComposerConversation)
    const gif = { title: 'Celebration', url: 'https://example.com/celebration.gif' }

    wrapper.findComponent(MessageComposer).vm.$emit('gif', gif)
    await nextTick()

    expect(wrapper.get('img[alt="Celebration"]').attributes('src')).toBe(gif.url)
  })

})