import { onBeforeUnmount, onMounted } from 'vue'

import { useUiStore } from '@/stores/ui'

// Keyboard shortcuts from the Keyboard Shortcuts popup, in ONE self-contained file.
//
// Nothing else in the project has to change except one line that switches it on:
//   useKeyboardShortcuts()        (call it once in a component that is always on screen,
//                                  for example <script setup> of src/views/HomeView.vue)
// It works by doing what a click would do: it uses the ui store for the panels and presses the
// existing buttons (found by their aria-label) for the message box and account menu. So it keeps
// working with the message box exactly as it is today.
//
// "Ctrl" means Ctrl, or Cmd on a Mac. Alt is only used for audio recording.
// An action that returns false means "not now": the key keeps its normal browser behaviour.
//
// Quick navigation (Ctrl+K) and attaching a recent file (Ctrl+2) need UI/features the app does
// not currently provide.

// ---------- helpers that press things on the page ----------

function findButton(root, label) {
  return [...root.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-label') === label,
  )
}

// Press a button like a real click would (the message box buttons save the text selection on
// mousedown first). Returns false when the button is missing or disabled.
function press(button) {
  if (!button || button.disabled) return false
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  button.click()
  return true
}

function pressInComposer(label) {
  return (event) => {
    const composer = event.target.closest('.message-composer')
    return press(composer && findButton(composer, label))
  }
}

function hoveredMessage(event) {
  const target = event.target instanceof Element ? event.target : null
  const focusedMessage = target?.closest('[data-message-id]')
  if (focusedMessage) return focusedMessage

  return [...document.querySelectorAll('.composer-conversation__message:hover')].at(-1) ?? null
}

function runMessageAction(event, label) {
  const message = hoveredMessage(event)
  if (!message) return false

  if (label === 'Copy') {
    const copyButton = findButton(message, 'Copy message')
    return press(copyButton)
  }

  const menu = message.querySelector('.composer-conversation__menu')
  if (menu) {
    const action = [...menu.querySelectorAll('button')].find(
      (button) => button.textContent.trim().split(/\s+/)[0] === label,
    )
    if (action) return press(action)
  }

  const moreButton = findButton(message, 'More message actions')
  if (!press(moreButton)) return false

  setTimeout(() => {
    const action = [...message.querySelectorAll('.composer-conversation__menu button')].find(
      (button) => button.textContent.trim().split(/\s+/)[0] === label,
    )
    press(action)
  }, 0)
  return true
}

let highlightedMessage = null

function moveMessageHighlight(direction, event) {
  const target = event.target instanceof Element ? event.target : null
  const input = target?.closest('.message-composer__input')
  if (!input || input.textContent.trim()) return false

  const messages = [
    ...document.querySelectorAll('.composer-conversation__message[data-message-id]'),
  ]
  if (!messages.length) return false

  let index = messages.indexOf(highlightedMessage)
  if (direction === 'latest') index = messages.length - 1
  else index = index < 0 ? messages.length - 2 : index - 1

  if (index < 0) return false
  highlightedMessage?.classList.remove('keyboard-shortcut-message-highlight')
  highlightedMessage = messages[index]
  highlightedMessage.classList.add('keyboard-shortcut-message-highlight')
  highlightedMessage.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

function openAccountSettings() {
  const avatar = document.querySelector('.user-module .avatar-btn')
  if (!avatar) return false
  if (avatar.getAttribute('aria-expanded') !== 'true') avatar.click()
  // the menu is drawn on the next tick
  setTimeout(() => {
    const item = [...document.querySelectorAll('.user-module [role="menuitem"]')].find(
      (button) => button.textContent.trim() === 'Account Settings',
    )
    item?.click()
  }, 0)
}

// ---------- the shortcuts ----------
// keys: 'ctrl' / 'shift' / 'alt' flags + the main key. Digits and the backslash are matched by their
// physical key, because Shift changes what the key types (Shift+8 types "*").
// where: 'anywhere' = works on the whole page, 'composer' = only while typing in the message box.

export function createShortcuts(ui) {
  return [
    // Navigation and other
    {
      name: 'Search messages',
      ctrl: true,
      key: 'f',
      where: 'anywhere',
      run: () => ui.openPanel('search'),
    },
    {
      name: 'Reminders',
      ctrl: true,
      shift: true,
      key: '2',
      where: 'anywhere',
      run: () => ui.openPanel('reminders'),
    },
    {
      name: 'Help',
      ctrl: true,
      shift: true,
      key: 'h',
      where: 'anywhere',
      run: () => ui.toggleHelpModal(),
    },
    {
      name: 'Account settings',
      ctrl: true,
      shift: true,
      key: 'i',
      where: 'anywhere',
      run: openAccountSettings,
    },
    {
      name: 'Channel settings',
      ctrl: true,
      shift: true,
      key: 'x',
      where: 'anywhere',
      run: () => (ui.selectedChannelId ? ui.openChannelSettings() : false),
    },
    {
      name: 'Pinned messages',
      ctrl: true,
      shift: true,
      key: '6',
      where: 'anywhere',
      run: () => ui.openPanel('pinned'),
    },

    // Actions on the hovered message, or the message containing focus.
    {
      name: 'Copy message',
      ctrl: true,
      key: 'g',
      where: 'anywhere',
      run: (event) => runMessageAction(event, 'Copy'),
    },
    {
      name: 'Edit message',
      ctrl: true,
      key: 'e',
      where: 'anywhere',
      run: (event) => runMessageAction(event, 'Edit'),
    },
    {
      name: 'Delete message',
      ctrl: true,
      key: 'd',
      where: 'anywhere',
      run: (event) => {
        const input = event.target.closest?.('.message-composer__input')
        if (input?.textContent.trim()) {
          return pressInComposer('Strikethrough')(event)
        }
        return runMessageAction(event, 'Delete')
      },
    },
    {
      name: 'Forward message',
      ctrl: true,
      key: 'h',
      where: 'anywhere',
      run: (event) => runMessageAction(event, 'Forward'),
    },
    {
      name: 'Reply to message',
      ctrl: true,
      key: 'j',
      where: 'anywhere',
      run: (event) => runMessageAction(event, 'Reply'),
    },
    {
      name: 'Set message reminder',
      ctrl: true,
      key: 'a',
      where: 'anywhere',
      run: (event) => runMessageAction(event, 'Set'),
    },
    {
      name: 'Highlight latest message',
      ctrl: false,
      key: 'arrowdown',
      where: 'composer',
      run: (event) => moveMessageHighlight('latest', event),
    },
    {
      name: 'Highlight previous message',
      ctrl: false,
      key: 'arrowup',
      where: 'composer',
      run: (event) => moveMessageHighlight('previous', event),
    },

    // Formatting (message box)
    { name: 'Bold', ctrl: true, key: 'b', where: 'composer', run: pressInComposer('Bold') },
    { name: 'Italic', ctrl: true, key: 'i', where: 'composer', run: pressInComposer('Italic') },
    {
      name: 'Underline',
      ctrl: true,
      key: 'u',
      where: 'composer',
      run: pressInComposer('Underline'),
    },
    {
      name: 'Code block',
      ctrl: true,
      shift: true,
      key: '\\',
      where: 'composer',
      run: pressInComposer('Code block'),
    },
    {
      name: 'Bulleted list',
      ctrl: true,
      shift: true,
      key: '8',
      where: 'composer',
      run: pressInComposer('Bulleted list'),
    },
    {
      name: 'Numbered list',
      ctrl: true,
      shift: true,
      key: '9',
      where: 'composer',
      run: pressInComposer('Numbered list'),
    },

    // Sending (message box)
    {
      name: 'Emoji',
      ctrl: true,
      shift: true,
      key: 'l',
      where: 'composer',
      run: pressInComposer('Emoji'),
    },
    {
      name: 'Attach file',
      ctrl: true,
      shift: true,
      key: 'u',
      where: 'composer',
      run: pressInComposer('Attachment'),
    },
    {
      name: 'Audio recording',
      ctrl: true,
      alt: true,
      key: 'o',
      where: 'composer',
      run: pressInComposer('Microphone'),
    },
    {
      name: 'Create poll',
      ctrl: true,
      shift: true,
      key: 'p',
      where: 'composer',
      run: pressInComposer('Insert poll'),
    },
    {
      name: 'Schedule message',
      ctrl: true,
      shift: true,
      key: 'y',
      where: 'composer',
      run: pressInComposer('Schedule message'),
    },
    // Turns the "important" flag on or off; the message is then sent as usual.
    {
      name: 'Important message',
      ctrl: true,
      shift: true,
      key: 'f3',
      where: 'composer',
      run: pressInComposer('Important message'),
    },
  ]
}

function matchesKey(event, key) {
  if (typeof event.key !== 'string') return false
  if (event.key.toLowerCase() === key) return true
  if (key === 'arrowdown') return event.key === 'ArrowDown'
  if (key === 'arrowup') return event.key === 'ArrowUp'
  if (/^\d$/.test(key)) return event.code === `Digit${key}` || event.code === `Numpad${key}`
  if (key === '\\') return event.code === 'Backslash'
  return false
}

export function findShortcut(shortcuts, event) {
  // Skip keys already handled elsewhere and keys typed through an input method (IME).
  if (event.defaultPrevented || event.isComposing) return null

  const ctrl = Boolean(event.ctrlKey || event.metaKey)
  const alt = Boolean(event.altKey)
  // The message box shortcuts work in the message box and on its buttons, but not in the other
  // inputs inside it (poll dialog, emoji search, date and time fields).
  const target = event.target instanceof Element ? event.target : null
  const inComposer = Boolean(
    target?.closest('.message-composer') && !target.matches('input, textarea, select'),
  )

  return (
    shortcuts.find(
      (item) =>
        ctrl === Boolean(item.ctrl) &&
        alt === Boolean(item.alt) &&
        Boolean(event.shiftKey) === Boolean(item.shift) &&
        (item.where === 'anywhere' || inComposer) &&
        matchesKey(event, item.key) &&
        // holding the keys down should not toggle things over and over
        !event.repeat,
    ) ?? null
  )
}

export function useKeyboardShortcuts() {
  const shortcuts = createShortcuts(useUiStore())

  function onKeydown(event) {
    const shortcut = findShortcut(shortcuts, event)
    if (!shortcut) return
    if (shortcut.run(event) === false) return
    event.preventDefault()
  }

  let highlightStyles

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
    highlightStyles = document.createElement('style')
    highlightStyles.textContent =
      '.keyboard-shortcut-message-highlight { outline: 2px solid #6366f1; background-color: #eef2ff; }'
    document.head.append(highlightStyles)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    highlightStyles?.remove()
    highlightedMessage?.classList.remove('keyboard-shortcut-message-highlight')
    highlightedMessage = null
  })
}
