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
  it('renders compact bullet and numbered-list icons', () => {
    const wrapper = mount(MessageComposer)

    expect(wrapper.get('button[aria-label="Bulleted list"] svg').classes()).toContain(
      'message-composer__list-icon',
    )
    expect(wrapper.get('button[aria-label="Bulleted list"] svg').attributes('viewBox')).toBe(
      '0 0 24 24',
    )
    expect(
      wrapper.get('button[aria-label="Bulleted list"] svg circle').attributes('cx'),
    ).toBe('3.5')
    expect(wrapper.get('button[aria-label="Numbered list"] svg').classes()).toContain(
      'message-composer__numbered-list-icon',
    )
  })

  it('shows poll and important-message icons in the toolbar', () => {
    const wrapper = mount(MessageComposer)

    expect(
      wrapper.get('button[aria-label="Insert poll"] svg rect').attributes('x'),
    ).toBe('2.5')
    const badge = wrapper.get(
      'button[aria-label="Important message"] .message-composer__important-badge',
    )
    expect(badge.attributes('cx')).toBe('19.5')
    expect(badge.attributes('cy')).toBe('17.5')
    expect(badge.attributes('r')).toBe('4')
    expect(
      wrapper
        .get('button[aria-label="Important message"] .message-composer__important-badge-mark')
        .exists(),
    ).toBe(true)
  })

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

  it('sends the message when Enter is pressed', async () => {
    const wrapper = mount(MessageComposer)
    setEditorText(wrapper, 'Send with Enter')

    await wrapper.get('[contenteditable="true"]').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('send')).toEqual([
      [{ content: 'Send with Enter', attachments: [] }],
    ])
  })

  it('keeps Shift+Enter available for a new line', async () => {
    const wrapper = mount(MessageComposer)
    setEditorText(wrapper, 'Keep typing')

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
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



  it('toggles a bulleted list on and off for the current text', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'first')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)
    const button = wrapper.get('button[aria-label="Bulleted list"]')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(input.element.querySelector('ul > li').textContent).toBe('first')
    expect(input.element.innerHTML).toBe('<ul><li>first</li></ul>')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(input.element.querySelector('ul')).toBeNull()
    expect(input.element.textContent).toBe('first')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')).toEqual([[{ content: 'first', attachments: [] }]])
    wrapper.unmount()
  })

  it('toggles a numbered list on and off for the current text', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'first')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)
    const button = wrapper.get('button[aria-label="Numbered list"]')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(input.element.innerHTML).toBe('<ol><li>first</li></ol>')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(input.element.querySelector('ol')).toBeNull()
    expect(input.element.textContent).toBe('first')
    wrapper.unmount()
  })

  it('switches between bulleted and numbered lists with only one active', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'first')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)

    const bulletButton = wrapper.get('button[aria-label="Bulleted list"]')
    const numberButton = wrapper.get('button[aria-label="Numbered list"]')

    await bulletButton.trigger('click')
    expect(input.element.innerHTML).toBe('<ul><li>first</li></ul>')
    expect(bulletButton.attributes('aria-pressed')).toBe('true')

    await numberButton.trigger('mousedown')
    await numberButton.trigger('click')
    expect(input.element.innerHTML).toBe('<ol><li>first</li></ol>')
    expect(bulletButton.attributes('aria-pressed')).toBe('false')
    expect(numberButton.attributes('aria-pressed')).toBe('true')

    await bulletButton.trigger('mousedown')
    await bulletButton.trigger('click')
    expect(input.element.innerHTML).toBe('<ul><li>first</li></ul>')
    expect(bulletButton.attributes('aria-pressed')).toBe('true')
    expect(numberButton.attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('clears other active formatting buttons when a list button is clicked', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = wrapper.get('[contenteditable="true"]')
    input.element.innerHTML = '<strong><em><s>first</s></em></strong>'
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
    const text = input.element.querySelector('s').firstChild
    const range = document.createRange()
    range.selectNodeContents(text)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)

    const bulletButton = wrapper.get('button[aria-label="Bulleted list"]')
    await bulletButton.trigger('mousedown')
    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Strikethrough"]').attributes('aria-pressed')).toBe(
      'true',
    )

    await bulletButton.trigger('click')

    expect(bulletButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Numbered list"]').attributes('aria-pressed')).toBe(
      'false',
    )
    for (const label of ['Bold', 'Italic', 'Strikethrough', 'Underline', 'Code block']) {
      expect(wrapper.get(`button[aria-label="${label}"]`).attributes('aria-pressed')).toBe('false')
    }
    expect(input.element.querySelector('ul strong em s').textContent).toBe('first')
    wrapper.unmount()
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



  it('toggles code styling without changing or sending the message', async () => {

    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'const value = 1')

    selectEditorText(input)

    const codeButton = wrapper.get('button[aria-label="Code block"]')

    await codeButton.trigger('mousedown')
    await codeButton.trigger('click')

    expect(input.element.textContent).toBe('const value = 1')
    expect(input.classes()).toContain('message-composer__input--code')
    expect(codeButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.emitted('send')).toBeUndefined()

    await codeButton.trigger('mousedown')
    await codeButton.trigger('click')

    expect(input.element.textContent).toBe('const value = 1')
    expect(input.classes()).not.toContain('message-composer__input--code')
    expect(codeButton.attributes('aria-pressed')).toBe('false')
    expect(wrapper.emitted('send')).toBeUndefined()
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