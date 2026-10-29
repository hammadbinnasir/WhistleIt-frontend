import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChannelsStore } from '@/features/channels'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMessagesStore } from '@/features/messages/messages'
import { useRemindersStore } from '@/features/search/reminders'
import { useUiStore } from '@/stores/ui'

const emojiPickerProps = vi.hoisted(() => vi.fn())

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      emits: ['select'],
      props: ['native', 'hideSearch'],
      setup(props, { emit }) {
        emojiPickerProps(props)
        return () =>
          h('button', {
            class: 'test-emoji-picker-option',
            onClick: () => emit('select', { i: '🥳' }),
          })
      },
    }),
  }
})

import ComposerConversation from './ComposerConversation.vue'
import MessageComposer from './MessageComposer.vue'

describe('composer conversation', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  async function sendMessage(wrapper, content) {
    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.textContent = content
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await wrapper.findComponent(MessageComposer).get('form').trigger('submit')
    await nextTick()
  }

  function buttonWithText(wrapper, content) {
    return wrapper.findAll('button').find((button) => button.text().includes(content))
  }

  it('shows a sent message in the conversation', async () => {
    const wrapper = mount(ComposerConversation)

    const composer = wrapper.findComponent(MessageComposer)
    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.textContent = 'Hello team'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(composer.get('button[aria-label="Send message"]').attributes('disabled')).toBeUndefined()

    await composer.get('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('You')

    expect(wrapper.text()).toContain('Hello team')

    expect(wrapper.get('time').attributes('datetime')).toBeTruthy()

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

  it('keeps channel messages scoped to the channel they were sent in', async () => {
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-one', conversationType: 'channel' },
    })
    const send = async (text) => {
      const editor = wrapper.get('[contenteditable="true"]')
      editor.element.textContent = text
      editor.element.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      await wrapper.get('form').trigger('submit')
    }

    await send('Only in channel one')
    expect(wrapper.text()).toContain('Only in channel one')

    await wrapper.setProps({ conversationId: 'channel-two' })
    expect(wrapper.text()).not.toContain('Only in channel one')

    await send('Only in channel two')
    expect(wrapper.text()).toContain('Only in channel two')
    expect(wrapper.text()).not.toContain('Only in channel one')

    await wrapper.setProps({ conversationId: 'channel-one' })
    expect(wrapper.text()).toContain('Only in channel one')
    expect(wrapper.text()).not.toContain('Only in channel two')
    wrapper.unmount()
  })

  it('shows edit and delete only for messages sent by the current user', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = dms.startDm('u2')
    dms.sendMessage(conversation.id, { content: 'My message' })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })
    const receivedArticle = wrapper.findAll('article')[0]
    await receivedArticle.get('button[aria-label="More message actions"]').trigger('click')

    const receivedMenu = receivedArticle.get('.composer-conversation__menu')
    expect(buttonWithText(receivedMenu, 'Edit')).toBeUndefined()
    expect(buttonWithText(receivedMenu, 'Delete')).toBeUndefined()

    const ownArticle = wrapper
      .findAll('article')
      .find((article) => article.text().includes('My message'))
    await ownArticle.get('button[aria-label="More message actions"]').trigger('click')
    const ownMenu = ownArticle.get('.composer-conversation__menu')
    expect(buttonWithText(ownMenu, 'Edit')).toBeDefined()
    expect(buttonWithText(ownMenu, 'Delete')).toBeDefined()
    expect(buttonWithText(ownMenu, 'Edit').attributes('disabled')).toBeUndefined()
    expect(buttonWithText(ownMenu, 'Delete').attributes('disabled')).toBeUndefined()
  })

  it('supports message reactions, pinning, and editing', async () => {
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'A message to update')

    const article = wrapper.get('article')
    await article.get('button[aria-label="Add reaction"]').trigger('click')
    await article.get('.test-emoji-picker-option').trigger('click')
    expect(article.text()).toContain('🥳 1')
    expect(emojiPickerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ native: false, hideSearch: false }),
    )

    await article.get('button[aria-label="Pin message"]').trigger('click')
    expect(ui.pinnedMessages).toHaveLength(1)

    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Edit').trigger('click')
    const editForm = article.get('.composer-conversation__edit-form')
    await editForm.get('textarea').setValue('Edited message')
    await editForm.trigger('submit')

    expect(article.text()).toContain('Edited message')
    expect(article.text()).toContain('(edited)')
  })

  it('copies message text from the toolbar copy button', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Copy this message')

    await wrapper.get('button[aria-label="Copy message"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('Copy this message')
    expect(wrapper.get('button[aria-label="Copy message"] svg').exists()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('falls back to the browser copy command when clipboard access is blocked', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'Copy with fallback')

    await wrapper.get('button[aria-label="Copy message"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('Copy with fallback')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(ui.toasts.at(-1)).toMatchObject({ title: 'Copied', type: 'success' })
    expect(document.querySelector('textarea[readonly]')).toBeNull()

    if (originalExecCommand) {
      Object.defineProperty(document, 'execCommand', originalExecCommand)
    } else {
      delete document.execCommand
    }
    vi.unstubAllGlobals()
  })

  it('deletes a message and removes its pin', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'Remove this message')
    const article = wrapper.get('article')

    await article.get('button[aria-label="Pin message"]').trigger('click')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Delete').trigger('click')
    await nextTick()

    expect(wrapper.text()).not.toContain('Remove this message')
    expect(ui.pinnedMessages).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it('replies to a message with an attached quoted message', async () => {
    const wrapper = mount(ComposerConversation)
    const messages = useMessagesStore()
    await sendMessage(wrapper, 'Original message')
    const article = wrapper.get('article')

    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Reply').trigger('click')
    expect(wrapper.text()).toContain('Replying to You')

    await sendMessage(wrapper, 'A reply')
    expect(messages.messagesFor('general').at(-1).replyTo).toMatchObject({
      content: 'Original message',
      author: 'You',
    })
    expect(wrapper.text()).toContain('A reply')
  })

  it('renders a link preview card and safe clickable link', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Check this https://example.com/launch-plan')

    const preview = wrapper.get('.composer-conversation__link-preview')
    expect(preview.text()).toContain('Launch Plan')
    expect(preview.attributes('href')).toBe('https://example.com/launch-plan')
    expect(preview.attributes('rel')).toBe('noopener noreferrer')
  })

  it('opens the reminder message dialog from message actions', async () => {
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'Remember this update')
    const article = wrapper.get('article')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Set Reminder').trigger(
      'click',
    )

    await wrapper.get('[aria-label="Reminder title"]').setValue('Review tomorrow')
    await wrapper.get('.reminder-dialog').trigger('submit')

    const reminders = useRemindersStore()
    expect(reminders.items[0]).toMatchObject({
      text: 'Remember this update',
      title: 'Review tomorrow',
      conversationId: 'general',
    })
    expect(ui.toasts[0].title).toBe('Reminder set')
  })

  it('forwards a message to another channel', async () => {
    const channels = useChannelsStore()
    channels.upsertChannel({ id: 'random', name: 'random', isArchived: false, isFavorite: false })
    const messages = useMessagesStore()
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Forward this update')
    const article = wrapper.get('article')

    await article.get('button[aria-label="More message actions"]').trigger('click')
    const forwardAction = buttonWithText(article.get('.composer-conversation__menu'), 'Forward')
    expect(forwardAction.find('svg').exists()).toBe(true)
    await forwardAction.trigger('click')
    await wrapper.get('form.composer-conversation__forward-dialog').trigger('submit')

    expect(messages.messagesFor('random')[0]).toMatchObject({
      content: 'Forward this update',
      forwardedFrom: 'You in general',
    })
  })

  it('groups messages and loads older history in pages', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = Array.from({ length: 21 }, (_, index) => ({
      id: `m${index}`,
      content: `History ${index}`,
      author: 'Teammate',
      authorId: 'teammate',
      mine: false,
      createdAt: new Date(Date.UTC(2026, 9, 28, 10, index)).toISOString(),
    }))
    const wrapper = mount(ComposerConversation)

    expect(wrapper.findAll('article')).toHaveLength(20)
    expect(wrapper.findAll('.composer-conversation__date')).toHaveLength(1)
    expect(wrapper.findAll('.composer-conversation__avatar')).toHaveLength(1)

    await wrapper.get('.composer-conversation__load-older').trigger('click')
    expect(wrapper.findAll('article')).toHaveLength(21)
    expect(wrapper.findAll('.composer-conversation__date')).toHaveLength(1)
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