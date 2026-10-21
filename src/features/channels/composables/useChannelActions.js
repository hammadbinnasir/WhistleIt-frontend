import { useChannelsStore } from '../store/channels.store'
import { useChannelsUiStore } from '../store/channels.ui.store'

// Shared by the sidebar context menu and the header menu so both behave identically.
export function useChannelActions() {
  const store = useChannelsStore()
  const ui = useChannelsUiStore()

  function menuItemsFor(channel) {
    if (!channel) return []
    const base = [
      { key: 'favorite', label: channel.isFavorite ? 'Unfavorite Channel' : 'Favorite Channel' },
      { key: 'mute', label: channel.isMuted ? 'Unmute Channel' : 'Mute Channel' },
      { key: 'unread', label: 'Mark as unread' },
    ]
    const manage = []
    if (channel.canManage) manage.push({ key: 'edit', label: 'Edit Channel' })
    if (!channel.isDefault) manage.push({ key: 'leave', label: 'Leave Channel', danger: true })
    if (channel.canManage && !channel.isDefault) {
      manage.push({ key: 'archive', label: 'Archive Channel', danger: true })
    }
    return manage.length ? [...base, { key: 'sep', divider: true }, ...manage] : base
  }

  async function run(action, channel) {
    if (!channel) return
    try {
      switch (action) {
        case 'favorite':
          await store.toggleFavorite(channel.id)
          break
        case 'mute':
          await store.toggleMute(channel.id)
          break
        case 'unread':
          await store.markUnread(channel.id)
          break
        case 'edit':
          ui.openEdit(channel.id)
          break
        case 'leave':
        case 'archive':
          ui.openConfirm(action, channel)
          break
      }
    } catch (err) {
      ui.notify(err?.message || 'Something went wrong. Please try again.')
    }
  }

  return { menuItemsFor, run }
}
