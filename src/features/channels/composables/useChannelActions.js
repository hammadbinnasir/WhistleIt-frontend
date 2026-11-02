import { useChannelsUiStore } from '../store/channels.ui.store'

// Shared by the sidebar context menu and the header menu so both behave identically.
export function useChannelActions() {
  const ui = useChannelsUiStore()

  function menuItemsFor(channel) {
    if (!channel) return []
    const manage = []
    if (channel.canManage) manage.push({ key: 'edit', label: 'Edit Channel' })
    if (!channel.isDefault) manage.push({ key: 'leave', label: 'Leave Channel', danger: true })
    if (channel.canManage && !channel.isDefault) {
      manage.push({ key: 'delete', label: 'Delete Channel', danger: true })
    }
    return manage
  }

  async function run(action, channel) {
    if (!channel) return
    try {
      switch (action) {
        case 'edit':
          ui.openEdit(channel.id)
          break
        case 'leave':
        case 'delete':
          ui.openConfirm(action, channel)
          break
      }
    } catch (err) {
      ui.notify(err?.message || 'Something went wrong. Please try again.')
    }
  }

  return { menuItemsFor, run }
}
