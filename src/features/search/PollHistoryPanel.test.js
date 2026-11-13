import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChannelsStore } from '@/features/channels'
import PollHistoryPanel from './PollHistoryPanel.vue'

const pollApi = vi.hoisted(() => ({
  listPolls: vi.fn(),
}))
vi.mock('@/features/composer/api/polls.api', () => pollApi)

describe('poll history panel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    pollApi.listPolls.mockReset().mockResolvedValue([])
  })

  it('shows channel polls returned by the API and removes the old local history', async () => {
    const channelId = 'channel-1'
    useChannelsStore().upsertChannel({ id: channelId, name: 'Research' })
    localStorage.setItem(
      'whistleit:channel-poll-history',
      JSON.stringify({
        [channelId]: [{ id: 'local-poll', title: 'Local-only poll' }],
      }),
    )
    pollApi.listPolls.mockResolvedValue([
      {
        id: 'server-poll-1',
        channel_id: channelId,
        title: 'Created in the channel chat',
        status: 'open',
        audience_responses: 'anonymous',
        created_at: '2026-11-11T10:00:00.000Z',
      },
      {
        id: 'other-channel-poll',
        channel_id: 'another-channel',
        title: 'Poll in another channel',
        created_at: '2026-11-10T10:00:00.000Z',
      },
    ])

    const wrapper = mount(PollHistoryPanel, { props: { channelId } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Created in the channel chat'))

    expect(pollApi.listPolls).toHaveBeenCalledWith(channelId)
    expect(wrapper.text()).toContain('Polls in Research')
    expect(wrapper.text()).toContain('Anonymous')
    expect(wrapper.text()).not.toContain('Poll in another channel')
    expect(wrapper.text()).not.toContain('Local-only poll')
    expect(localStorage.getItem('whistleit:channel-poll-history')).toBeNull()
    wrapper.unmount()
  })

  it('reports an error when the poll history API request fails', async () => {
    pollApi.listPolls.mockRejectedValue(new Error('Poll access denied.'))

    const wrapper = mount(PollHistoryPanel, { props: { channelId: 'private-channel' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Poll access denied.'))

    expect(wrapper.get('[role="alert"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows scheduled status for polls returned by the API', async () => {
    const channelId = 'scheduled-channel'
    useChannelsStore().upsertChannel({ id: channelId, name: 'Scheduled Channel' })
    pollApi.listPolls.mockResolvedValue([
      {
        id: 'server-scheduled-poll',
        channel_id: channelId,
        title: 'Future poll',
        schedule_start: '2099-11-11T12:00:00.000Z',
        created_at: '2026-11-11T10:00:00.000Z',
      },
    ])

    const wrapper = mount(PollHistoryPanel, { props: { channelId } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Future poll'))

    expect(wrapper.text()).toContain('Scheduled')
    wrapper.unmount()
  })
})
