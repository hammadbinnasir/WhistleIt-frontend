import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { UserModule } from '../index'
import { useUserStore, resetUserStore } from '../composables/useUserStore'

let wrapper
const store = useUserStore()

const $ = (sel) => document.body.querySelector(sel)
const $$ = (sel) => [...document.body.querySelectorAll(sel)]
const byText = (text, sel = 'button') => $$(sel).find((el) => el.textContent.trim() === text)

const click = async (el) => {
  expect(el, 'element to click').toBeTruthy()
  el.click()
  await flushPromises()
}

const setValue = async (el, value) => {
  expect(el, 'input to fill').toBeTruthy()
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

const openMenu = () => click($('.avatar-btn'))
const openStatusMenu = async () => {
  await openMenu()
  await click(byText('Update your status'))
}
const openSettings = async () => {
  await openMenu()
  await click(byText('Account Settings'))
}
const tab = (label) => byText(label, '[role=tab]')

beforeEach(() => {
  resetUserStore()
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  wrapper = mount(UserModule, {
    props: { user: { profile: { fullName: 'Hammad Haider' } } },
    attachTo: document.body,
  })
})

afterEach(() => {
  wrapper.unmount()
  document.body.innerHTML = ''
})

describe('avatar and user menu', () => {
  it('shows only the avatar with initials and the online badge', () => {
    expect($('.avatar-btn')).toBeTruthy()
    expect($('.initials').textContent).toBe('HH')
    expect($('.badge.online')).toBeTruthy()
    expect($('.avatar-btn').title).toBe('Hammad Haider')
    expect($('[role=menu]')).toBeNull()
  })

  it('opens UserMenu when the avatar is clicked and toggles it closed', async () => {
    await openMenu()
    expect(byText('Update your status')).toBeTruthy()
    expect(byText('Account Settings')).toBeTruthy()
    expect(byText('Leave Team')).toBeTruthy()
    expect(byText('Log Out')).toBeTruthy()

    await openMenu()
    expect($('[role=menu]')).toBeNull()
  })

  it('closes the menu on outside click and on Escape', async () => {
    await openMenu()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect($('[role=menu]')).toBeNull()

    await openMenu()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect($('[role=menu]')).toBeNull()
  })

  it('emits log-out and closes the menu', async () => {
    await openMenu()
    await click(byText('Log Out'))
    expect(wrapper.emitted('log-out')).toHaveLength(1)
    expect($('[role=menu]')).toBeNull()
  })
})

describe('leave team confirmation', () => {
  const openLeave = async () => {
    await openMenu()
    await click(byText('Leave Team'))
  }

  it('shows the confirmation dialog instead of leaving immediately', async () => {
    await openLeave()
    const dialog = $('[role=alertdialog]')
    expect(dialog).toBeTruthy()
    expect($('#confirm-title').textContent).toBe('Leave Team')
    expect($('#confirm-message').textContent).toBe('Are you sure you want to leave this team?')
    expect(byText('CANCEL')).toBeTruthy()
    expect(byText('LEAVE')).toBeTruthy()
    expect($('[role=menu]')).toBeNull()
    expect(wrapper.emitted('leave-team')).toBeUndefined()
  })

  it('CANCEL, Escape and backdrop click dismiss it without leaving', async () => {
    await openLeave()
    await click(byText('CANCEL'))
    expect($('[role=alertdialog]')).toBeNull()

    await openLeave()
    $('.backdrop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect($('[role=alertdialog]')).toBeNull()

    await openLeave()
    $('.backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect($('[role=alertdialog]')).toBeNull()

    expect(wrapper.emitted('leave-team')).toBeUndefined()
  })

  it('LEAVE emits leave-team and closes the dialog', async () => {
    await openLeave()
    await click(byText('LEAVE'))
    expect(wrapper.emitted('leave-team')).toHaveLength(1)
    expect($('[role=alertdialog]')).toBeNull()
  })
})

describe('status menu', () => {
  it('replaces UserMenu with StatusMenu (only one menu visible)', async () => {
    await openStatusMenu()
    expect(byText('Update custom status')).toBeTruthy()
    expect($$('[role=menu]')).toHaveLength(1)
    expect($('.status-menu')).toBeTruthy()
    expect($('.menu')).toBeNull() // UserMenu is gone
    expect(byText('Log Out')).toBeUndefined()
    expect($('.status-menu .item.active').textContent).toContain('Online')
  })

  it('changes status, updates the avatar badge and closes the menus', async () => {
    await openStatusMenu()
    await click(byText('Away', '.status-menu .label').closest('button'))

    expect(store.state.status).toBe('away')
    expect($('.badge.away')).toBeTruthy()
    expect($('.badge.online')).toBeNull()
    expect($('[role=menu]')).toBeNull()
    expect(wrapper.emitted('status-change')[0]).toEqual(['away'])
  })

  it('supports Do Not Disturb and Offline', async () => {
    await openStatusMenu()
    await click(byText('Do Not Disturb', '.status-menu .label').closest('button'))
    expect($('.badge.dnd')).toBeTruthy()

    await openStatusMenu()
    await click(byText('Offline', '.status-menu .label').closest('button'))
    expect($('.badge.offline')).toBeTruthy()
  })
})

describe('custom status modal', () => {
  const openStatusModal = async () => {
    await openStatusMenu()
    await click(byText('Update custom status'))
  }

  const pickPredefined = (label) => click(byText(label, '.row .label').closest('button'))
  const openDropdown = () => click($('.select-field .trigger'))
  const chooseOption = (label) => click(byText(label, '[role=option]'))

  it('opens StatusModal from the status menu with no menu left behind', async () => {
    await openStatusModal()
    expect($('[role=dialog]')).toBeTruthy()
    expect($('#status-title').textContent).toBe('Set a Status')
    expect($('[role=menu]')).toBeNull()
    expect($('.popover')).toBeNull()
    expect($('.menu')).toBeNull() // UserMenu is not rendered in the background
  })

  it('starts on the predefined list and keeps SAVE disabled while empty', async () => {
    await openStatusModal()
    expect($('.subtitle').textContent).toBe('Some Predefined Statuses')
    expect($$('.row')).toHaveLength(5)
    expect($('.select-field')).toBeNull()
    expect(byText('SAVE').disabled).toBe(true)
  })

  it('typing a custom text keeps the list and saves with "Never"', async () => {
    await openStatusModal()
    await setValue($('.input'), 'emergency')
    expect($('.subtitle')).toBeTruthy()
    await click(byText('SAVE'))
    expect(store.state.customStatus).toBe('emergency')
    expect(store.state.customStatusExpiresAt).toBeNull()
  })

  it('picking a predefined status shows the "Remove status after" view', async () => {
    await openStatusModal()
    await pickPredefined('In a meeting')

    expect($('.input').value).toBe('In a meeting')
    expect($('.clear-x')).toBeTruthy() // X replaces the coffee cup
    expect($('.cup')).toBeNull()
    expect($('.subtitle')).toBeNull() // predefined list is hidden
    expect($('.select-field .float-label').textContent).toBe('Remove status after')
    expect($('.select-field .value').textContent).toBe('Never')
    expect(byText('SAVE').disabled).toBe(false)
    expect(byText('CLEAR STATUS')).toBeTruthy()
  })

  it('the dropdown lists every duration and highlights the selected one', async () => {
    await openStatusModal()
    await pickPredefined('Commuting')
    await openDropdown()

    const options = $$('[role=option]').map((o) => o.textContent.trim())
    expect(options).toEqual(['Never', '30 minutes', '1 hour', '4 hours', 'Today', 'Choose Date'])
    expect($('[role=option].selected').textContent.trim()).toBe('Never')
  })

  it('selecting a duration updates the field and closes the dropdown', async () => {
    await openStatusModal()
    await pickPredefined('Commuting')
    await openDropdown()
    await chooseOption('1 hour')

    expect($('[role=listbox]')).toBeNull()
    expect($('.select-field .value').textContent).toBe('1 hour')
    // modal itself must stay open
    expect($('[role=dialog]')).toBeTruthy()
  })

  it('saves the status with an expiry time for relative durations', async () => {
    const before = Date.now()
    await openStatusModal()
    await pickPredefined('In a meeting')
    await openDropdown()
    await chooseOption('30 minutes')
    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeNull()
    expect(store.state.customStatus).toBe('In a meeting')
    expect(store.state.customStatusDuration).toBe('30m')
    expect(store.state.customStatusExpiresAt).toBeGreaterThanOrEqual(before + 30 * 60 * 1000)
    expect(store.state.customStatusExpiresAt).toBeLessThan(Date.now() + 30 * 60 * 1000 + 1000)
    expect(wrapper.emitted('custom-status-change')[0][0]).toBe('In a meeting')
    expect($('.avatar-btn').title).toContain('In a meeting')
  })

  it('"Today" expires at the end of the current day', async () => {
    await openStatusModal()
    await pickPredefined('Sick Leave')
    await openDropdown()
    await chooseOption('Today')
    await click(byText('SAVE'))

    const end = new Date(store.state.customStatusExpiresAt)
    const now = new Date()
    expect(end.getFullYear()).toBe(now.getFullYear())
    expect(end.getMonth()).toBe(now.getMonth())
    expect(end.getDate()).toBe(now.getDate())
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })

  it('"Choose Date" shows a date field and requires a valid date to save', async () => {
    await openStatusModal()
    await pickPredefined('On Vacations')
    await openDropdown()
    await chooseOption('Choose Date')

    const dateInput = $('input[type=date]')
    expect(dateInput).toBeTruthy()
    expect(byText('SAVE').disabled).toBe(true)

    await setValue(dateInput, '2000-01-01') // in the past
    expect(byText('SAVE').disabled).toBe(true)

    const future = new Date()
    future.setDate(future.getDate() + 3)
    const pad = (n) => String(n).padStart(2, '0')
    const value = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`
    await setValue(dateInput, value)
    expect(byText('SAVE').disabled).toBe(false)

    await click(byText('SAVE'))
    const end = new Date(store.state.customStatusExpiresAt)
    expect(end.getDate()).toBe(future.getDate())
    expect(store.state.customStatusDuration).toBe('date')
  })

  it('the dropdown supports the keyboard and Escape only closes the dropdown', async () => {
    await openStatusModal()
    await pickPredefined('Commuting')
    const trigger = $('.select-field .trigger')

    const key = async (k) => {
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      )
      await flushPromises()
    }

    await key('ArrowDown') // opens
    expect($('[role=listbox]')).toBeTruthy()
    await key('ArrowDown') // → 30 minutes
    await key('ArrowDown') // → 1 hour
    await key('Enter')
    expect($('.select-field .value').textContent).toBe('1 hour')

    await key('ArrowDown')
    expect($('[role=listbox]')).toBeTruthy()
    await key('Escape')
    expect($('[role=listbox]')).toBeNull()
    expect($('[role=dialog]')).toBeTruthy() // modal still open
  })

  it('clicking outside the dropdown closes it', async () => {
    await openStatusModal()
    await pickPredefined('Commuting')
    await openDropdown()
    expect($('[role=listbox]')).toBeTruthy()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect($('[role=listbox]')).toBeNull()
  })

  it('the X in the input clears the text and returns to the predefined list', async () => {
    await openStatusModal()
    await pickPredefined('In a meeting')
    await click($('.clear-x'))

    expect($('.input').value).toBe('')
    expect($('.subtitle')).toBeTruthy()
    expect($('.select-field')).toBeNull()
    expect($('.cup')).toBeTruthy()
    expect(byText('SAVE').disabled).toBe(true)
  })

  it('prefills the saved status, its duration, and can clear it', async () => {
    await store.setCustomStatus('In a meeting', {
      duration: '4h',
      expiresAt: Date.now() + 4 * 3600e3,
    })
    await openStatusModal()
    expect($('.input').value).toBe('In a meeting')
    expect($('.select-field .value').textContent).toBe('4 hours')

    await click(byText('CLEAR STATUS'))
    expect(store.state.customStatus).toBe('')
    expect(store.state.customStatusDuration).toBe('never')
    expect(store.state.customStatusExpiresAt).toBeNull()
    expect($('[role=dialog]')).toBeNull()
  })

  it('removes the status automatically once it expires', async () => {
    vi.useFakeTimers()
    try {
      await store.setCustomStatus('Lunch', {
        duration: '30m',
        expiresAt: Date.now() + 30 * 60 * 1000,
      })
      expect(store.state.customStatus).toBe('Lunch')
      vi.advanceTimersByTime(30 * 60 * 1000 + 50)
      expect(store.state.customStatus).toBe('')
      expect(store.state.customStatusExpiresAt).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes with the X button, Escape, and a backdrop click', async () => {
    await openStatusModal()
    await click($('.close'))
    expect($('[role=dialog]')).toBeNull()

    await openStatusModal()
    $('.backdrop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect($('[role=dialog]')).toBeNull()

    await openStatusModal()
    $('.backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect($('[role=dialog]')).toBeNull()
  })
})

describe('account settings modal', () => {
  it('opens on the General tab from the user menu', async () => {
    await openSettings()
    expect($('#settings-title').textContent).toBe('Account Settings')
    expect($('.content-title').textContent).toBe('General Settings')
    expect(tab('General').getAttribute('aria-selected')).toBe('true')
    expect($('[role=menu]')).toBeNull()
  })

  it('switches between tabs and shows the matching panel', async () => {
    await openSettings()

    await click(tab('Security'))
    expect($('.content-title').textContent).toBe('Security Settings')
    expect($('#settings-panel-security').style.display).not.toBe('none')
    expect($('#settings-panel-general').style.display).toBe('none')

    await click(tab('User Preferences'))
    expect($('.content-title').textContent).toBe('User Preferences Settings')
    expect($('#settings-panel-preferences').style.display).not.toBe('none')

    await click(tab('Notifications'))
    expect($('.content-title').textContent).toBe('Notification Settings')
  })

  it('contains the new Job Responsibilities field after Designation', async () => {
    await openSettings()
    const inputs = $$('#settings-panel-general input[type=text]').map((i) => i.placeholder)
    expect(inputs.indexOf('Enter Job Responsibilities')).toBe(
      inputs.indexOf('Enter Designation') + 1,
    )
  })

  it('contains the workspace switching section after left click', async () => {
    await openSettings()
    await click(tab('User Preferences'))
    const titles = $$('#settings-panel-preferences .section-title').map((t) =>
      t.textContent.replace(/\s+/g, ' ').trim(),
    )
    expect(titles).toEqual([
      'When writing a message, press Enter to…',
      'When double click on message',
      'When left click on message',
      'When switching to a different workspace',
    ])
    expect(byText('Open in Current Tab', 'span')).toBeTruthy()
    expect(byText('Open in New Tab', 'span')).toBeTruthy()
  })

  it('saves profile fields and updates the avatar initials', async () => {
    await openSettings()
    await setValue($('input[placeholder="Full name"]'), 'Sara Khan')
    await setValue($('input[placeholder="Enter Designation"]'), 'Engineer')
    await setValue($('input[placeholder="Enter Job Responsibilities"]'), 'Build things')
    $('input[placeholder="Old Password"]').dispatchEvent(new Event('blur'))
    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeNull()
    expect(store.state.profile.fullName).toBe('Sara Khan')
    expect(store.state.profile.designation).toBe('Engineer')
    expect(store.state.profile.jobResponsibilities).toBe('Build things')
    expect($('.initials').textContent).toBe('SK')
    expect(wrapper.emitted('settings-saved')).toHaveLength(1)
  })

  it('saves preferences without validating or redirecting to unrelated tabs', async () => {
    await openSettings()
    await click(tab('User Preferences'))
    await setValue($('input[placeholder="Full name"]'), '   ')
    $('input[placeholder="Old Password"]').dispatchEvent(new Event('blur'))
    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeNull()
    expect(store.state.profile.fullName).toBe('Hammad Haider')
    expect(store.state.security.hideEmail).toBe(false)
    expect(wrapper.emitted('settings-saved')[0][0]).toHaveProperty('preferences')
  })

  it('saves preferences from the User Preferences tab', async () => {
    await openSettings()
    await click(tab('User Preferences'))
    await click($('input[name="pref-enterKey"][value="newline"]'))
    await click($('input[name="pref-workspaceSwitch"][value="new"]'))
    await click(byText('SAVE'))

    expect(store.state.preferences.enterKey).toBe('newline')
    expect(store.state.preferences.workspaceSwitch).toBe('new')
    expect(store.state.preferences.doubleClick).toBe('default')
  })

  it('keeps unsaved input when switching tabs', async () => {
    await openSettings()
    await setValue($('input[placeholder="Enter Designation"]'), 'Lead')
    await click(tab('Security'))
    await click(tab('General'))
    expect($('input[placeholder="Enter Designation"]').value).toBe('Lead')
  })

  it('saves the hide-email toggle on the Security tab', async () => {
    await openSettings()
    await click(tab('Security'))
    const toggle = $('[role=switch]')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await click(byText('SAVE'))
    expect(store.state.security.hideEmail).toBe(true)
  })

  it('shows "Required." on the old password after leaving it empty', async () => {
    await openSettings()
    await click(tab('Security'))
    const old = $('input[placeholder="Old Password"]')
    old.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect($('.pw-error').textContent).toBe('Required.')
    expect($('.pw-control.invalid')).toBeTruthy()
  })

  it('toggles password visibility with the eye button', async () => {
    await openSettings()
    await click(tab('Security'))
    const input = $('input[placeholder="Enter New Password"]')
    expect(input.type).toBe('password')
    await click($$('.eye')[1])
    expect(input.type).toBe('text')
    await click($$('.eye')[1])
    expect(input.type).toBe('password')
  })

  it('validates password changes and only saves when valid', async () => {
    await openSettings()
    await click(tab('Security'))

    await setValue($('input[placeholder="Enter New Password"]'), 'abcdefgh')
    await setValue($('input[placeholder="Confirm New Password"]'), 'different')
    await click(byText('SAVE'))

    // blocked: modal still open, errors visible
    expect($('[role=dialog]')).toBeTruthy()
    const errors = $$('.pw-error').map((e) => e.textContent)
    expect(errors).toContain('Required.')
    expect(errors).toContain('Passwords do not match.')

    await setValue($('input[placeholder="Old Password"]'), 'oldpass123')
    await setValue($('input[placeholder="Confirm New Password"]'), 'abcdefgh')
    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeNull()
    const payload = wrapper.emitted('settings-saved')[0][0]
    expect(payload.password).toEqual({ oldPassword: 'oldpass123', newPassword: 'abcdefgh' })
  })

  it('does not require a password when the user is not changing it', async () => {
    await openSettings()
    await click(tab('Security'))
    await click(byText('SAVE'))
    expect($('[role=dialog]')).toBeNull()
    expect(wrapper.emitted('settings-saved')[0][0].password).toBeNull()
  })

  it('discards changes on CANCEL and on the X button', async () => {
    await openSettings()
    await setValue($('input[placeholder="Enter Designation"]'), 'Should not persist')
    await click(byText('CANCEL'))
    expect($('[role=dialog]')).toBeNull()
    expect(store.state.profile.designation).toBe('')

    await openSettings()
    expect($('input[placeholder="Enter Designation"]').value).toBe('')
    await click($('.close'))
    expect($('[role=dialog]')).toBeNull()
  })

  it('does not close on backdrop click (protects unsaved input) but closes on Escape', async () => {
    await openSettings()
    $('.backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect($('[role=dialog]')).toBeTruthy()

    $('.backdrop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect($('[role=dialog]')).toBeNull()
  })

  it('validates and previews the profile photo', async () => {
    await openSettings()
    const fileInput = $('input[type=file]')

    const pick = async (file) => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await flushPromises()
    }

    await pick(new File(['x'], 'doc.pdf', { type: 'application/pdf' }))
    expect($('.photo-error').textContent).toContain('JPEG, JPG, GIF or PNG')

    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 })
    await pick(big)
    expect($('.photo-error').textContent).toContain('2 MB')

    await pick(new File(['x'], 'me.png', { type: 'image/png' }))
    expect($('.photo-error')).toBeNull()
    expect($('.avatar img').getAttribute('src')).toBe('blob:mock')

    await click(byText('SAVE'))
    expect(store.state.profile.photoUrl).toBe('blob:mock')
    expect($('.avatar-btn img')).toBeTruthy()
    expect(wrapper.emitted('settings-saved')[0][0].photoAction).toBe('added')
  })

  it('removes a saved profile photo and restores initials in the account icon', async () => {
    await store.saveSettings({
      profile: { fullName: 'Hammad Haider' },
      photo: new File(['x'], 'me.png', { type: 'image/png' }),
    })
    await openSettings()

    await click(byText('REMOVE PHOTO'))
    expect($('.avatar img')).toBeNull()
    expect($('.remove-btn')).toBeNull()

    await click(byText('SAVE'))

    expect(store.state.profile.photoUrl).toBe('')
    expect($('.avatar-btn img')).toBeNull()
    expect($('.avatar-btn .initials').textContent).toBe('HH')
    expect(wrapper.emitted('settings-saved')[0][0].photoAction).toBe('removed')
  })
})

describe('full journey', () => {
  it('walks avatar → menu → status menu → custom status → settings → security', async () => {
    await openMenu()
    await click(byText('Update your status'))
    await click(byText('Update custom status'))
    expect($('#status-title')).toBeTruthy()
    await setValue($('.input'), 'Working Remotely')
    await click(byText('SAVE'))
    expect(store.state.customStatus).toBe('Working Remotely')

    await openMenu()
    await click(byText('Account Settings'))
    await click(tab('Security'))
    expect($('.content-title').textContent).toBe('Security Settings')
    await click(byText('CANCEL'))
    expect($('[role=dialog]')).toBeNull()
  })
})
