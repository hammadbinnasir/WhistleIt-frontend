import { describe, expect, it } from 'vitest'
import { createShortcuts, findShortcut } from './useKeyboardShortcuts'

function find({
  key,
  ctrlKey = true,
  shiftKey = false,
  altKey = false,
  composer = false,
  targetClass = '',
}) {
  const target = document.createElement('div')
  if (targetClass) target.className = targetClass
  if (composer || targetClass) {
    const composerElement = document.createElement('div')
    composerElement.className = 'message-composer'
    composerElement.append(target)
  }
  const event = {
    key,
    code: '',
    ctrlKey,
    metaKey: false,
    shiftKey,
    altKey,
    repeat: false,
    defaultPrevented: false,
    isComposing: false,
    target,
  }

  return findShortcut(createShortcuts({}), event)?.name ?? null
}

describe('keyboard shortcuts', () => {
  it('uses Ctrl+Shift+H for Help instead of Ctrl+Escape', () => {
    expect(find({ key: 'h', shiftKey: true })).toBe('Help')
    expect(find({ key: 'Escape' })).toBeNull()
  })

  it('uses Ctrl+Alt+O for audio recording', () => {
    expect(find({ key: 'o', altKey: true, composer: true })).toBe('Audio recording')
    expect(find({ key: 'o', shiftKey: true, composer: true })).toBeNull()
  })

  it('does not register a screen recording shortcut', () => {
    expect(find({ key: 's', shiftKey: true, composer: true })).toBeNull()
  })

  it('uses Ctrl+Shift+F3 for Important message instead of Ctrl+1', () => {
    expect(find({ key: 'F3', shiftKey: true, composer: true })).toBe('Important message')
    expect(find({ key: '1', composer: true })).toBeNull()
  })

  it('registers the message action shortcuts only against unmodified expected keys', () => {
    expect(find({ key: 'g' })).toBe('Copy message')
    expect(find({ key: 'e' })).toBe('Edit message')
    expect(find({ key: 'd' })).toBe('Delete message')
    expect(find({ key: 'h' })).toBe('Forward message')
    expect(find({ key: 'j' })).toBe('Reply to message')
    expect(find({ key: 'a' })).toBe('Set message reminder')
  })

  it('registers pinned drawer and empty-composer message navigation shortcuts', () => {
    expect(find({ key: '6', shiftKey: true })).toBe('Pinned messages')
    expect(find({ key: 'ArrowDown', ctrlKey: false, targetClass: 'message-composer__input' })).toBe(
      'Highlight latest message',
    )
    expect(find({ key: 'ArrowUp', ctrlKey: false, targetClass: 'message-composer__input' })).toBe(
      'Highlight previous message',
    )
  })

  it('routes Ctrl+D to strikethrough when the composer has text', () => {
    const composer = document.createElement('div')
    composer.className = 'message-composer'
    const input = document.createElement('div')
    input.className = 'message-composer__input'
    input.textContent = 'draft'
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Strikethrough')
    composer.append(input, button)
    let clicked = false
    button.addEventListener('click', () => {
      clicked = true
    })

    const event = {
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      defaultPrevented: false,
      isComposing: false,
      target: input,
    }
    const shortcut = findShortcut(createShortcuts({}), event)

    expect(shortcut.name).toBe('Delete message')
    expect(shortcut.run(event)).toBe(true)
    expect(clicked).toBe(true)
  })
})
