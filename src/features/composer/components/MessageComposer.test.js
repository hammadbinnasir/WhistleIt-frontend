import { mount } from '@vue/test-utils'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      emits: ['select'],
      setup(_, { emit }) {
        const categories = [
          'Frequently used',
          'Smileys & People',
          'Animals & Nature',
          'Food & Drink',
          'Activities',
          'Travel places',
          'Objects',
          'Symbols',
          'Flags',
        ]

        return () =>
          h('div', [
            h(
              'div',
              { class: 'v3-header' },
              h(
                'div',
                { class: 'v3-groups' },
                categories.map((category) =>
                  h('button', { class: 'v3-group', title: category, 'aria-label': category }),
                ),
              ),
            ),
            h('input', { 'aria-label': 'Search emojis' }),
            h(
              'button',
              { 'aria-label': 'beaming face', onClick: () => emit('select', { i: '😁' }) },
              '😁',
            ),
          ])
      },
    }),
  }
})

import MessageComposer from './MessageComposer.vue'



afterEach(() => {

  vi.restoreAllMocks()

})



function setEditorText(wrapper, text) {

  const editor = wrapper.get('[contenteditable="true"]')

  editor.element.textContent = text

  editor.element.dispatchEvent(new Event('input', { bubbles: true }))

  return editor

}



function selectEditorText(editor) {

  editor.element.focus()

  const range = document.createRange()

  range.selectNodeContents(editor.element)

  const selection = document.getSelection()

  selection.removeAllRanges()

  selection.addRange(range)

}



describe('message composer', () => {

  it('sends a non-empty message and clears the editor', async () => {

    const wrapper = mount(MessageComposer)

    const input = setEditorText(wrapper, 'Hello team')



    await wrapper.get('form').trigger('submit')



    expect(wrapper.emitted('send')).toEqual([[{ content: 'Hello team', attachments: [] }]])

    expect(input.element.textContent).toBe('')

  })



  it('does not send an empty message', async () => {

    const wrapper = mount(MessageComposer)



    expect(wrapper.get('button[aria-label="Send message"]').attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')



    expect(wrapper.emitted('send')).toBeUndefined()

  })



  it('keeps formatting options independently toggleable', async () => {

    const wrapper = mount(MessageComposer)

    const input = setEditorText(wrapper, 'hello')

    selectEditorText(input)



    await wrapper.get('button[aria-label="Bold"]').trigger('click')

    await wrapper.get('button[aria-label="Italic"]').trigger('click')



    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')



    await wrapper.get('button[aria-label="Bold"]').trigger('click')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')

  })



  it('does not activate bold when applying or removing underline and italic', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'hello')

    selectEditorText(input)



    await wrapper.get('button[aria-label="Underline"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Underline"]').trigger('click')

    await wrapper.get('button[aria-label="Italic"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Italic"]').trigger('click')



    expect(input.element.innerHTML).toBe('<u><em>hello</em></u>')

    expect(wrapper.get('button[aria-label="Underline"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')



    await wrapper.get('button[aria-label="Italic"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Italic"]').trigger('click')



    expect(input.element.innerHTML).toBe('<u>hello</u>')

    expect(wrapper.get('button[aria-label="Underline"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('false')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    wrapper.unmount()

  })



  it('types only the remaining active format after toggling bold off', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = wrapper.get('[contenteditable="true"]')

    input.element.focus()

    const range = document.createRange()

    range.selectNodeContents(input.element)

    range.collapse(false)

    const selection = document.getSelection()

    selection.removeAllRanges()

    selection.addRange(range)



    for (const label of ['Bold', 'Italic', 'Bold']) {

      const button = wrapper.get(`button[aria-label="${label}"]`)

      await button.trigger('mousedown')

      await button.trigger('click')

    }



    input.element.focus()

    range.selectNodeContents(input.element)

    range.collapse(false)

    selection.removeAllRanges()

    selection.addRange(range)

    input.element.dispatchEvent(

      new InputEvent('beforeinput', {

        inputType: 'insertText',

        data: 'formatted',

        bubbles: true,

        cancelable: true,

      }),

    )



    expect(input.element.innerHTML).toBe('<em>formatted</em>')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')

    wrapper.unmount()

  })



  it('converts rich list content to a message list', async () => {

    const wrapper = mount(MessageComposer)

    const input = wrapper.get('[contenteditable="true"]')

    input.element.innerHTML = '<ul><li>first</li></ul>'

    input.element.dispatchEvent(new Event('input', { bubbles: true }))



    const execCommand = vi.fn()

    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    await wrapper.get('button[aria-label="Bulleted list"]').trigger('click')

    expect(wrapper.get('button[aria-label="Bulleted list"]').attributes('aria-pressed')).toBe(

      'true',

    )

    await wrapper.get('button[aria-label="Bulleted list"]').trigger('click')

    expect(wrapper.get('button[aria-label="Bulleted list"]').attributes('aria-pressed')).toBe(

      'false',

    )

    await wrapper.get('form').trigger('submit')



    expect(execCommand.mock.calls).toEqual([['insertUnorderedList'], ['insertUnorderedList']])

    expect(wrapper.emitted('send')).toEqual([[{ content: '• first', attachments: [] }]])

  })



  it('converts ordered list content to a numbered message list', async () => {

    const wrapper = mount(MessageComposer)

    const input = wrapper.get('[contenteditable="true"]')

    input.element.innerHTML = '<ol><li>first</li></ol>'

    input.element.dispatchEvent(new Event('input', { bubbles: true }))



    await wrapper.get('form').trigger('submit')



    expect(wrapper.emitted('send')).toEqual([[{ content: '1. first', attachments: [] }]])

  })



  it('toggles important status independently and includes it when sending', async () => {

    const wrapper = mount(MessageComposer)

    setEditorText(wrapper, 'A critical update')

    const importantButton = wrapper.get('button[aria-label="Important message"]')



    await importantButton.trigger('click')

    await importantButton.trigger('click')

    expect(wrapper.find('.message-composer__important').exists()).toBe(false)

    expect(importantButton.attributes('aria-pressed')).toBe('false')



    await importantButton.trigger('click')

    expect(wrapper.find('.message-composer__important').text()).toBe('IMPORTANT!')

    expect(importantButton.attributes('aria-pressed')).toBe('true')

    await wrapper.get('form').trigger('submit')



    expect(wrapper.emitted('send')).toEqual([

      [{ content: 'A critical update', attachments: [], important: true }],

    ])

    expect(wrapper.find('.message-composer__important').exists()).toBe(false)

    expect(importantButton.attributes('aria-pressed')).toBe('false')

  })



  it('inserts a code block and preserves its markdown in the message', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'const value = 1')

    selectEditorText(input)

    await wrapper.get('button[aria-label="Code block"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Code block"]').trigger('click')



    const code = input.element.querySelector('pre code')

    expect(code.textContent).toBe('const value = 1')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([

      [{ content: '```\nconst value = 1\n```', attachments: [] }],

    ])

    wrapper.unmount()

  })



  it('schedules a message and clears the editor', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'Reminder')



    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('TZ: Asia/Karachi')

    await wrapper.get('button.message-composer__custom-choice').trigger('click')

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)

    const dialog = document.querySelector('[aria-labelledby="message-schedule-title"]')

    expect(dialog).not.toBeNull()

    expect(dialog.textContent).toContain('Select date')

    expect(dialog.textContent).toContain('Select time')

    expect(dialog.textContent).toContain('Today')

    expect(dialog.textContent).toContain('Save')

    const dateInput = document.querySelector('#message-scheduled-date')

    dateInput.value = '2099-10-23'

    dateInput.dispatchEvent(new Event('input', { bubbles: true }))

    dateInput.dispatchEvent(new Event('change', { bubbles: true }))

    const timeInput = document.querySelector('#message-scheduled-time')

    timeInput.value = '09:30'

    timeInput.dispatchEvent(new Event('input', { bubbles: true }))

    timeInput.dispatchEvent(new Event('change', { bubbles: true }))

    await wrapper.vm.$nextTick()

    document.querySelector('.message-composer__schedule-modal-actions .is-primary').click()



    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('schedule')).toEqual([

      [

        {

          content: 'Reminder',

          scheduledAt: '2099-10-23T09:30',

          timeZone: 'Asia/Karachi',

          attachments: [],

        },

      ],

    ])

    expect(input.element.textContent).toBe('')

    expect(document.querySelector('[aria-labelledby="message-schedule-title"]')).toBeNull()

    wrapper.unmount()

  })



  it('closes the custom schedule modal without scheduling when cancelled', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    setEditorText(wrapper, 'Keep this message')



    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('button.message-composer__custom-choice').trigger('click')

    expect(document.querySelector('[aria-labelledby="message-schedule-title"]')).not.toBeNull()

    document.querySelector('.message-composer__schedule-modal-actions .is-secondary').click()

    await wrapper.vm.$nextTick()



    expect(document.querySelector('[aria-labelledby="message-schedule-title"]')).toBeNull()

    expect(wrapper.emitted('schedule')).toBeUndefined()

    expect(wrapper.get('[contenteditable="true"]').text()).toBe('Keep this message')

    wrapper.unmount()

  })



  it('schedules from the quick time options in Karachi time', async () => {

    const wrapper = mount(MessageComposer)

    setEditorText(wrapper, 'Quick reminder')



    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    const choices = wrapper.findAll('.message-composer__schedule-choice')

    expect(choices[0].text()).toMatch(/^(Today|Tomorrow) at 1:00 PM$/)

    expect(choices[1].text()).toMatch(/^Monday at 9:00 AM$/)

    await choices[0].trigger('click')



    expect(wrapper.emitted('schedule')[0][0]).toMatchObject({

      content: 'Quick reminder',

      timeZone: 'Asia/Karachi',

    })

    expect(wrapper.emitted('schedule')[0][0].scheduledAt).toMatch(/T13:00$/)

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)

  })



  it('closes the schedule menu from outside and Escape', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(true)



    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)



    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)

    wrapper.unmount()

  })



  it('shows a dismissible top-right error when scheduling without text or attachments', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('.message-composer__schedule-choice').trigger('click')



    const toast = document.querySelector('.message-composer__schedule-toast')

    expect(toast).not.toBeNull()

    expect(toast.getAttribute('role')).toBe('alert')

    expect(toast.textContent).toContain('Error!')

    expect(toast.textContent).toContain('Type some text or attach files to Schedule.')

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(true)



    document.querySelector('button[aria-label="Dismiss notification"]').click()

    await wrapper.vm.$nextTick()

    expect(document.querySelector('.message-composer__schedule-toast')).toBeNull()

    wrapper.unmount()

  })



  it('allows scheduling an attachment without message text', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const fileInput = wrapper.get('input[type="file"]').element

    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [attachment] })

    fileInput.dispatchEvent(new Event('change', { bubbles: true }))



    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('.message-composer__schedule-choice').trigger('click')



    expect(wrapper.emitted('schedule')[0][0]).toMatchObject({

      content: '',

      attachments: [attachment],

      timeZone: 'Asia/Karachi',

    })

    expect(document.querySelector('.message-composer__schedule-toast')).toBeNull()

    wrapper.unmount()

  })



  it('forwards media actions that do not open the file picker', async () => {

    const wrapper = mount(MessageComposer)



    await wrapper.get('button[aria-label="Video"]').trigger('click')

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')



    expect(wrapper.emitted('video')).toHaveLength(1)

    expect(wrapper.emitted('microphone')).toHaveLength(1)

  })


  it('opens and dismisses the emoji picker and opens the file picker', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const editor = setEditorText(wrapper, 'Hello')

    selectEditorText(editor)

    await wrapper.get('button[aria-label="Emoji"]').trigger('mousedown')
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')
    expect(wrapper.get('.picker').exists()).toBe(true)

    await wrapper.get('button[aria-label="Animals & Nature"]').trigger('click')
    expect(wrapper.get('.picker').attributes('data-active-category')).toBe('animals_nature')

    await wrapper.get('button[aria-label="beaming face"]').trigger('click')
    expect(wrapper.find('.picker').exists()).toBe(false)


    const fileInput = wrapper.get('input[type="file"]')

    const clickFileInput = vi.spyOn(fileInput.element, 'click')

    await wrapper.get('button[aria-label="Document"]').trigger('click')

    await wrapper.get('button[aria-label="Attachment"]').trigger('click')

    expect(clickFileInput).toHaveBeenCalledTimes(2)

    wrapper.unmount()

  })

})