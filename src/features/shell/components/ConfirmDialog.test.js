import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from './ConfirmDialog.vue'

const wrappers = []

function mountDialog(props = {}) {
  const wrapper = mount(ConfirmDialog, {
    attachTo: document.body,
    props: {
      isOpen: true,
      title: 'Delete team',
      message: 'Delete the team Design? This can’t be undone.',
      ...props,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('ConfirmDialog', () => {
  it('emits confirm', async () => {
    const wrapper = mountDialog()

    await wrapper.get('.shell-primary-button').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('emits cancel from the cancel button and Escape', async () => {
    const wrapper = mountDialog()
    await wrapper.get('.shell-secondary-button').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })

  it('does not cancel while loading and disables both buttons', async () => {
    const wrapper = mountDialog({ loading: true })

    expect(wrapper.findAll('button:disabled')).toHaveLength(2)
    expect(wrapper.get('[role="alertdialog"]').attributes('aria-busy')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('renders backend errors inline', () => {
    const wrapper = mountDialog({ errorMessage: 'You do not have permission.' })

    expect(wrapper.get('[role="alert"]').text()).toBe('You do not have permission.')
  })

  it('traps focus within its buttons', async () => {
    const wrapper = mountDialog()
    const confirmButton = wrapper.get('.shell-primary-button').element
    confirmButton.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    document.dispatchEvent(event)

    expect(preventDefault).toHaveBeenCalled()
    expect(document.activeElement).toBe(wrapper.get('.shell-secondary-button').element)
  })

  it('returns focus to the opener when dismissed', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = mountDialog()
    await wrapper.vm.$nextTick()
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)

    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
