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

const addResponsibility = async (value) => {
  const input = $('.responsibility-input')
  await setValue(input, value)
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
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
  sessionStorage.setItem('authToken', 'test-token')
  sessionStorage.setItem('authUser', JSON.stringify({ id: 'test-user', fullName: 'Hammad Haider' }))
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () =>
        options.method === 'POST' && String(url).endsWith('/avatar')
          ? {
              data: {
                avatar_url:
                  'http://10.0.105.90:8000/api/v1/avatars/avatars/test-user/avatar.jpg',
              },
            }
          : {},
    })),
  )
  wrapper = mount(UserModule, {
    props: { user: { profile: { fullName: 'Hammad Haider' } } },
    attachTo: document.body,
  })
})

afterEach(() => {
  wrapper.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('avatar and user menu', () => {
  it('shows only the avatar with initials and the online badge', () => {
    expect($('.avatar-btn')).toBeTruthy()
    expect($('.initials').textContent).toBe('HH')
    expect($('.badge.online')).toBeTruthy()
    expect($('.avatar-tooltip-name').textContent.trim()).toBe('Hammad Haider')
    expect($('.avatar-tooltip-title')).toBeNull()
    expect($('.avatar-btn').getAttribute('aria-describedby')).toBe('user-avatar-tooltip')
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
    const [url, options] = fetch.mock.calls.find(
      ([requestUrl, request]) =>
        request.method === 'PUT' && String(requestUrl).endsWith('/v1/users/test-user/status'),
    )
    expect(url).toContain('/v1/users/test-user/status')
    expect(JSON.parse(options.body)).toEqual({ mode: 'away' })
  })

  it('keeps the previous status and emits an error when the status update fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Status update failed' }),
    })

    await openStatusMenu()
    await click(byText('Away', '.status-menu .label').closest('button'))

    expect(store.state.status).toBe('online')
    expect($('.badge.online')).toBeTruthy()
    expect(wrapper.emitted('status-change')).toBeUndefined()
    expect(wrapper.emitted('error')[0][0].message).toContain('Status update failed')
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
    expect($('.status-emoji').textContent).toBe('☕')
    await click(byText('SAVE'))
    expect(store.state.customStatus).toBe('emergency')
    expect(store.state.customStatusEmoji).toBe('☕')
    expect(store.state.customStatusExpiresAt).toBeNull()
    const [url, options] = fetch.mock.calls.find(
      ([requestUrl, request]) =>
        request.method === 'PUT' && String(requestUrl).endsWith('/v1/users/test-user/status'),
    )
    expect(url).toContain('/v1/users/test-user/status')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({
      custom_status: { emoji: '☕', text: 'emergency' },
    })
  })

  it('shows preset status emojis and does not render an emoji picker', async () => {
    await openStatusModal()
    expect($$('.row .icon').map((item) => item.textContent.trim())).toEqual([
      '📅',
      '🚌',
      '🤒',
      '🌴',
      '🏠',
    ])
    expect($('button[aria-label="Choose status emoji"]')).toBeNull()
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
    expect($('.avatar-btn').getAttribute('aria-label')).toContain('In a meeting')
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
    const [url, options] = fetch.mock.calls.find(
      ([requestUrl, request]) =>
        request.method === 'DELETE' &&
        String(requestUrl).endsWith('/v1/users/test-user/status/custom'),
    )
    expect(url).toContain('/v1/users/test-user/status/custom')
    expect(options.method).toBe('DELETE')
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
    const fields = $$('#settings-panel-general input[type=text], #settings-panel-general input[type=search]')
    const placeholders = fields.map((field) => field.placeholder)
    expect(placeholders.indexOf('Enter Job Responsibilities')).toBe(
      placeholders.indexOf('Enter Designation') + 1,
    )
    expect($('.field-hint').textContent.trim()).toBe('Press enter to add (Maximum 5 allowed)')
    expect($('.responsibility-input').name).toBe('job-responsibility-entry')
    expect($('.responsibility-input').autocomplete).toBe('new-password')
    expect($('.responsibility-input').readOnly).toBe(true)
    expect($('.responsibility-input').value).toBe('')
    await $('.responsibility-input').focus()
    await flushPromises()
    expect($('.responsibility-input').readOnly).toBe(false)
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
    await addResponsibility('Build things')
    await addResponsibility('Support team')
    $('input[placeholder="Old Password"]').dispatchEvent(new Event('blur'))
    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeNull()
    expect(store.state.profile.fullName).toBe('Sara Khan')
    expect(store.state.profile.designation).toBe('Engineer')
    expect(store.state.profile.jobResponsibilities).toBe('Build things\nSupport team')
    expect($('.initials').textContent).toBe('SK')
    expect(wrapper.emitted('settings-saved')).toHaveLength(1)
    const [url, options] = fetch.mock.calls.find(([, request]) => request.method === 'PATCH')
    expect(url).toContain('/v1/users/test-user/profile')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({
      name: 'Sara Khan',
      display_name: '',
      two_factor: 'inactive',
      title: 'Engineer',
      job_responsibilities: ['Build things', 'Support team'],
    })
  })

  it('adds responsibilities as removable chips and limits the list to five', async () => {
    await openSettings()
    for (const item of ['One', 'Two', 'Three', 'Four', 'Five']) {
      await addResponsibility(item)
    }

    expect($$('.responsibility-chip')).toHaveLength(5)
    expect(
      $$('.responsibility-chip').map((chip) => chip.textContent.replace('×', '').trim()),
    ).toEqual(['One', 'Two', 'Three', 'Four', 'Five'])
    expect($('.responsibility-input').disabled).toBe(true)
    expect($('.field-error')).toBeNull()
    await click($('button[aria-label="Remove One"]'))
    expect($$('.responsibility-chip')).toHaveLength(4)
    expect($('.responsibility-input').disabled).toBe(false)
  })

  it('does not update profile state or close settings when profile save fails', async () => {
    await openSettings()
    await setValue($('input[placeholder="Full name"]'), 'Unsaved Name')
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ message: 'Profile update failed' }),
    })

    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeTruthy()
    expect(store.state.profile.fullName).toBe('Hammad Haider')
    expect(wrapper.emitted('settings-saved')).toBeUndefined()
    expect(wrapper.emitted('error')[0][0].message).toContain('Profile update failed')
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
    await click($('input[name="pref-leftClick"][value="default"]'))
    await click($('input[name="pref-workspaceSwitch"][value="new"]'))
    await click(byText('SAVE'))

    expect(store.state.preferences.enterKey).toBe('newline')
    expect(store.state.preferences.workspaceSwitch).toBe('new')
    expect(store.state.preferences.doubleClick).toBe('default')
    const [url, options] = fetch.mock.calls.find(([, request]) => request.method === 'PATCH')
    expect(url).toContain('/v1/users/test-user/preferences')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({
      enter_key: 'newline',
      double_click: 'default',
      left_click: 'default_click',
      workspace_switch: 'new',
    })
  })

  it('sends the API enum for the Open Menu left-click preference', async () => {
    await openSettings()
    await click(tab('User Preferences'))
    await click($('input[name="pref-leftClick"][value="menu"]'))
    await click(byText('SAVE'))

    const [, options] = fetch.mock.calls.find(([, request]) => request.method === 'PATCH')
    expect(JSON.parse(options.body).left_click).toBe('open_menu')
  })

  it('keeps preferences unchanged and settings open when the API update fails', async () => {
    await openSettings()
    await click(tab('User Preferences'))
    await click($('input[name="pref-enterKey"][value="newline"]'))
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ message: 'Preferences update failed' }),
    })

    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeTruthy()
    expect(store.state.preferences.enterKey).toBe('send')
    expect(wrapper.emitted('error')[0][0].message).toContain('Preferences update failed')
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
    const [url, options] = fetch.mock.calls.find(([requestUrl]) =>
      String(requestUrl).endsWith('/email-visibility'),
    )
    expect(url).toContain('/v1/users/test-user/email-visibility')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ email_visibility: false })
  })

  it('shows "Required." on the old password after leaving it empty', async () => {
    await openSettings()
    await click(tab('Security'))
    const old = $('input[placeholder="Old Password"]')
    expect(old.autocomplete).toBe('new-password')
    expect(old.readOnly).toBe(true)
    old.focus()
    await flushPromises()
    expect(old.readOnly).toBe(false)
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
    expect(payload.password).toEqual({
      oldPassword: 'oldpass123',
      newPassword: 'abcdefgh',
      newPasswordConfirmation: 'abcdefgh',
    })
    const [url, options] = fetch.mock.calls.find(([, request]) => request.method === 'PUT')
    expect(url).toContain('/v1/users/test-user/password')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({
      old_password: 'oldpass123',
      new_password: 'abcdefgh',
      new_password_confirmation: 'abcdefgh',
    })
  })

  it('keeps the Security form open and emits an error when the password update fails', async () => {
    await openSettings()
    await click(tab('Security'))
    await setValue($('input[placeholder="Old Password"]'), 'oldpass123')
    await setValue($('input[placeholder="Enter New Password"]'), 'abcdefgh')
    await setValue($('input[placeholder="Confirm New Password"]'), 'abcdefgh')
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Current password is incorrect' }),
    })

    await click(byText('SAVE'))

    expect($('[role=dialog]')).toBeTruthy()
    expect(wrapper.emitted('error')[0][0].message).toContain('Current password is incorrect')
    expect(wrapper.emitted('settings-saved')).toBeUndefined()
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
    expect($('.avatar-btn img').getAttribute('src')).toBe('blob:mock')
    expect(wrapper.emitted('settings-saved')[0][0].photoAction).toBe('added')

    const [url, options] = fetch.mock.calls.find(([requestUrl]) =>
      requestUrl.endsWith('/v1/users/test-user/avatar'),
    )
    expect(url).toContain('/v1/users/test-user/avatar')
    expect(options.method).toBe('POST')
    expect(options.body.get('avatar').name).toBe('me.png')
    expect(options.headers['Content-Type']).toBeUndefined()
  })

  it('shows the uploaded image in the profile icon when the upload response omits a URL', async () => {
    fetch.mockImplementation(async (_url, options) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => (options.method === 'POST' ? { message: 'Avatar uploaded' } : {}),
    }))
    await openSettings()
    const fileInput = $('input[type=file]')
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['image'], 'me.png', { type: 'image/png' })],
      configurable: true,
    })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()

    await click(byText('SAVE'))

    expect(store.state.profile.photoUrl).toBe('blob:mock')
    expect($('.avatar-btn img').getAttribute('src')).toBe('blob:mock')
  })

  it('loads the user profile and saved image URL', async () => {
    fetch.mockClear()
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'User retrieved successfully.',
        data: {
          id: 'test-user',
          name: 'Saved User',
          display_name: 'saved',
          title: 'Engineer',
          job_responsibilities: ['Design systems', 'Build things'],
          avatar_url: 'http://10.0.105.90:8000//api//v1//avatars//avatars//test-user//saved.png',
          presence: 'away',
          custom_status: 'Working remotely',
          preferences: {
            enter_key: 'newline',
            double_click: 'reminder',
            left_click: 'default_click',
            workspace_switch: 'new',
          },
        },
      }),
    })

    await store.loadUserProfile()
    await flushPromises()

    const [url, options] = fetch.mock.calls.at(-1)
    expect(url).toContain('/v1/users/test-user/profile')
    expect(options.method).toBe('GET')
    expect(store.state.profile.fullName).toBe('Saved User')
    expect(store.state.profile.alias).toBe('saved')
    expect(store.state.profile.designation).toBe('Engineer')
    expect(store.state.profile.jobResponsibilities).toBe('Design systems\nBuild things')
    expect(store.state.profile.photoUrl).toBe(
      'http://10.0.105.90:8000/api/v1/avatars/avatars/test-user/saved.png',
    )
    expect(store.state.status).toBe('away')
    expect(store.state.customStatus).toBe('Working remotely')
    expect(store.state.preferences).toEqual({
      enterKey: 'newline',
      doubleClick: 'reminder',
      leftClick: 'default',
      workspaceSwitch: 'new',
    })
    expect($('.avatar-btn img').getAttribute('src')).toBe(
      'http://10.0.105.90:8000/api/v1/avatars/avatars/test-user/saved.png',
    )
    expect($('.avatar-tooltip-name').textContent.trim()).toBe('Saved User')
    expect($('.avatar-tooltip-title').textContent.trim()).toBe('Engineer')
  })

  it('requests the user profile automatically when the account module mounts', () => {
    const request = fetch.mock.calls.find(([url]) =>
      String(url).includes('/v1/users/test-user/profile'),
    )

    expect(request).toBeTruthy()
    expect(request[0]).toContain('/v1/users/test-user/profile')
    expect(request[1].method).toBe('GET')
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/v1/users/test-user/settings'))).toBe(
      false,
    )
  })

  it('removes a saved profile photo and restores initials in the account icon', async () => {
    await store.saveSettings({
      profile: { fullName: 'Hammad Haider' },
      photo: new File(['x'], 'me.png', { type: 'image/png' }),
    })
    await openSettings()

    await click(byText('REMOVE PHOTO'))
    expect($('.panel .general .avatar img')).toBeNull()
    expect($('.remove-btn')).toBeNull()

    await click(byText('SAVE'))

    expect(store.state.profile.photoUrl).toBe('')
    expect($('.avatar-btn img')).toBeNull()
    expect($('.avatar-btn .initials').textContent).toBe('HH')
    expect(wrapper.emitted('settings-saved')[0][0].photoAction).toBe('removed')
    const [url, options] = fetch.mock.calls.find(([, request]) => request.method === 'DELETE')
    expect(url).toContain('/v1/users/test-user/avatar')
    expect(options.method).toBe('DELETE')
  })

  it('does not clear the stored avatar when the delete request fails', async () => {
    store.hydrate({ profile: { photoUrl: 'https://example.test/old.png' } })
    await openSettings()
    await click(byText('REMOVE PHOTO'))
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Avatar delete failed' }),
    })

    await click(byText('SAVE'))

    expect(store.state.profile.photoUrl).toBe('https://example.test/old.png')
    expect($('[role=dialog]')).toBeTruthy()
    expect(wrapper.emitted('error')[0][0].message).toContain('Avatar delete failed')
  })

  it('does not replace the stored avatar when upload fails', async () => {
    store.hydrate({ profile: { photoUrl: 'https://example.test/old.png' } })
    await openSettings()
    const fileInput = $('input[type=file]')
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['image'], 'new.png', { type: 'image/png' })],
      configurable: true,
    })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Avatar upload failed' }),
    })

    await click(byText('SAVE'))

    expect(store.state.profile.photoUrl).toBe('https://example.test/old.png')
    expect($('[role=dialog]')).toBeTruthy()
    expect(wrapper.emitted('error')[0][0].message).toContain('Avatar upload failed')
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
