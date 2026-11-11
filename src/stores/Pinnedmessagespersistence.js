// Keeps the UI store's pinned messages in browser storage so they survive a page reload.
// A message leaves storage only when it is unpinned (removed from ui.pinnedMessages).

export const PINNED_MESSAGES_KEY = 'whistleit:pinned-messages'

function pinKey(item) {
  return `${item?.conversation?.id ?? ''}::${item?.id ?? ''}`
}

function readPinned(storage) {
  try {
    const stored = JSON.parse(storage.getItem(PINNED_MESSAGES_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((item) => item && typeof item === 'object') : []
  } catch (error) {
    console.error('Unable to load pinned messages from browser storage:', error)
    return []
  }
}


/**
 * Call once after Pinia is installed, e.g. in main.js:
 *   persistPinnedMessages(useUiStore(pinia))
 * Returns a function that stops persisting.
 */
export function persistPinnedMessages(ui, storage = globalThis.localStorage) {
  if (!ui || !storage || !Array.isArray(ui.pinnedMessages)) return () => {}

  // Restore saved pins, keeping anything the store already has (no duplicates).
  const saved = readPinned(storage)
  if (saved.length) {
    const current = ui.pinnedMessages
    const known = new Set(current.map(pinKey))
    const restored = [...current, ...saved.filter((item) => !known.has(pinKey(item)))]
    ui.$patch((state) => {
      state.pinnedMessages = restored
    })
  }

  let lastSaved = ''
  const save = () => {
    const pinned = Array.isArray(ui.pinnedMessages) ? ui.pinnedMessages : []
    let serialized
    try {
      serialized = JSON.stringify(pinned)
    } catch (error) {
      console.error('Unable to save pinned messages to browser storage:', error)
      return
    }
    if (serialized === lastSaved) return
    lastSaved = serialized
    try {
      storage.setItem(PINNED_MESSAGES_KEY, serialized)
    } catch (error) {
      console.error('Unable to save pinned messages to browser storage:', error)
    }
  }

  save()
  // $subscribe fires on direct changes too (push / splice / filter), including unpin.
  return ui.$subscribe(save, { detached: true })
}