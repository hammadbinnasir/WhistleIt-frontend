import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useRemindersStore } from './reminders'
import SearchPage from './SearchPage.vue'
import { useSearchStore } from './search.store'

describe('search tools', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('returns only messages matching a name in the selected channel', async () => {
    const wrapper = mount(SearchPage, { props: { channelId: 'frontend' } })
    await wrapper.get('input[type="search"]').setValue('Hammad Nasir')

    expect(wrapper.findAll('.search-result')).toHaveLength(1)
    expect(wrapper.get('.search-result').text()).toContain('Hammad Nasir')

    await wrapper.get('input[type="search"]').setValue('a name that is not in this channel')
    expect(wrapper.findAll('.search-result')).toHaveLength(0)
    expect(wrapper.get('.search-page__empty').text()).toContain('Nothing turned up')
  })

  it('searches files and links across WhistleIt conversations', async () => {
    const wrapper = mount(SearchPage, { props: { channelId: 'frontend' } })

    await wrapper.get('input[value="all"]').setValue()
    await wrapper.get('[role="tab"][aria-selected="false"]').trigger('click')
    expect(wrapper.findAll('.file-card__info')).toHaveLength(5)
    expect(wrapper.text()).toContain('Project requirements.pdf')

    const linkTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text().includes('Link'))
    await linkTab.trigger('click')
    expect(wrapper.findAll('.search-result__url')).toHaveLength(5)
    expect(wrapper.text()).toContain('photos.example.com')
  })

  it('sorts results and applies user and date filters', async () => {
    const wrapper = mount(SearchPage, { props: { channelId: 'frontend' } })
    await wrapper.get('.search-page__results-heading button').trigger('click')
    await wrapper.findAll('[role="menuitemradio"]')
      .find((option) => option.text().includes('Oldest first'))
      .trigger('click')
    expect(wrapper.find('.search-result').text()).toContain('Muhammad Abdullah Tariq')

    await wrapper.get('.search-page__filter-button').trigger('click')
    await wrapper.get('#filter-user').setValue('u3')
    await wrapper.get('.search-popover__apply').trigger('click')
    expect(wrapper.findAll('.search-result')).toHaveLength(1)
    expect(wrapper.get('.search-result').text()).toContain('Muhammad Abdullah Tariq')

    await wrapper.get('.search-page__filter-button').trigger('click')
    await wrapper.get('#filter-date-mode').setValue('after')
    await wrapper.get('.search-popover__dates input').setValue('2099-01-01')
    await wrapper.get('.search-popover__apply').trigger('click')
    expect(wrapper.findAll('.search-result')).toHaveLength(0)
  })

  it('limits channel members to signed-in users and adds selected users', () => {
    const store = useSearchStore()
    const existingIds = store.membersForChannel('frontend').map((member) => member.id)
    const candidate = store.availableMembers('frontend')[0]

    store.addMembers('frontend', [candidate.id, 'unknown-user'])

    expect(store.membersForChannel('frontend').map((member) => member.id)).toContain(candidate.id)
    expect(store.membersForChannel('frontend')).toHaveLength(existingIds.length + 1)
  })

  it('creates, deletes, and restores reminders', () => {
    const reminders = useRemindersStore()
    const message = {
      conversationId: 'frontend',
      conversationName: 'Frontend Team Cmi 2',
      messageId: 'test-message',
      text: 'Review the sprint.',
    }

    reminders.addReminder(message, new Date(Date.now() + 60_000).toISOString(), 'Check the plan')
    const added = reminders.activeReminders[0]
    expect(added.note).toBe('Check the plan')

    reminders.removeReminder(added.id)
    expect(reminders.deletedReminders[0].id).toBe(added.id)

    reminders.restoreReminder(added.id)
    expect(reminders.activeReminders[0].id).toBe(added.id)
  })
})
