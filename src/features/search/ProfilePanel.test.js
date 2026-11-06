import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUser, getUserProfile } from '@/features/account/api'
import { useUserStore } from '@/features/account/composables/useUserStore'
import { getAuthUserId } from '@/features/auth/session'
import ProfilePanel from './ProfilePanel.vue'

vi.mock('@/features/account/api', () => ({
  getUser: vi.fn(),
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}))

vi.mock('@/features/auth/session', () => ({
  getAuthUserId: vi.fn(),
}))

describe('ProfilePanel', () => {
  beforeEach(() => {
    getUser.mockReset()
    getUserProfile.mockReset()
    getAuthUserId.mockReturnValue('current-user')
    useUserStore().hydrate({ status: 'online' })
  })

  it('shows own profile information from the user profile endpoint', async () => {
    getUserProfile.mockResolvedValue({
      data: {
        full_name: 'Muhammad Abdullah Tariq',
        email: 'abdullah.tariq@example.com',
        status_mode: 'offline',
        designation: 'Frontend Intern',
        job_responsibilities: [],
      },
    })
    const wrapper = mount(ProfilePanel, {
      props: { member: { id: 'current-user', name: 'Member', status: 'online' } },
    })
    await flushPromises()

    expect(getUserProfile).toHaveBeenCalledWith('current-user')
    expect(getUser).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Muhammad Abdullah Tariq')
    expect(wrapper.text()).toContain('Online')
    expect(wrapper.get('a[href="mailto:abdullah.tariq@example.com"]').text()).toBe(
      'abdullah.tariq@example.com',
    )
    expect(wrapper.text()).toContain('Designation')
    expect(wrapper.text()).toContain('Frontend Intern')
    expect(wrapper.text()).toContain('No job responsibility added yet.')
    wrapper.unmount()
  })

  it('reactively reflects the current user status changes', async () => {
    getUserProfile.mockResolvedValue({
      data: { full_name: 'Current User', status_mode: 'online' },
    })
    const wrapper = mount(ProfilePanel, {
      props: { member: { id: 'current-user', name: 'Current User', status: 'online' } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Online')
    useUserStore().hydrate({ status: 'away' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Away')

    useUserStore().hydrate({ status: 'dnd' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Do not disturb')
    wrapper.unmount()
  })

  it('loads other users from the public user endpoint', async () => {
    getUser.mockResolvedValue({
      data: {
        data: {
          presence: 'online',
          user: {
            profile: {
              full_name: 'Alex Member',
              avatar_url: '/avatars/alex.png',
              presence: 'away',
              title: 'Product Designer',
              job_responsibilities: ['Design systems', 'Build things'],
            },
          },
          account: {
            email: 'alex@example.com',
          },
        },
      },
    })
    const wrapper = mount(ProfilePanel, {
      props: { member: { id: 'other-user', name: 'Member', status: 'online' } },
    })
    await flushPromises()

    expect(getUser).toHaveBeenCalledWith('other-user')
    expect(getUserProfile).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Alex Member')
    expect(wrapper.text()).toContain('Online')
    expect(wrapper.get('img').attributes('src')).toBe('/avatars/alex.png')
    expect(wrapper.get('a[href="mailto:alex@example.com"]').text()).toBe('alex@example.com')
    expect(wrapper.text()).toContain('Product Designer')
    expect(wrapper.findAll('.profile-panel__responsibilities li').map((item) => item.text())).toEqual(
      ['Design systems', 'Build things'],
    )
    wrapper.unmount()
  })

  it('reads object-shaped status fields like the channel avatar', async () => {
    getUser.mockResolvedValue({
      data: { presence: { state: 'away' } },
    })
    const wrapper = mount(ProfilePanel, {
      props: { member: { id: 'other-user', name: 'Member', status: 'unknown' } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Away')
    wrapper.unmount()
  })

  it('reports profile loading errors and keeps available member information', async () => {
    getAuthUserId.mockReturnValue('user-2')
    getUserProfile.mockRejectedValue(new Error('Profile request failed'))
    const wrapper = mount(ProfilePanel, {
      props: {
        member: {
          id: 'user-2',
          name: 'Member Two',
          email: 'member@example.com',
          status: 'online',
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Member Two')
    expect(wrapper.text()).toContain('member@example.com')
    expect(wrapper.text()).toContain('Profile request failed')
    wrapper.unmount()
  })

  it('updates the open own profile when Account General settings are saved', async () => {
    const account = useUserStore()
    account.hydrate({
      profile: {
        fullName: 'Old Name',
        designation: 'Old Designation',
        jobResponsibilities: 'Old responsibility',
        photoUrl: '',
      },
    })
    getUserProfile.mockResolvedValue({ data: { email: 'current@example.com' } })
    const wrapper = mount(ProfilePanel, {
      props: { member: { id: 'current-user', name: 'Old Name', status: 'online' } },
    })
    await flushPromises()

    await account.saveSettings({
      profile: {
        fullName: 'Updated Name',
        alias: '',
        twoFactor: 'inactive',
        designation: 'Updated Designation',
        jobResponsibilities: ['Updated responsibility'],
      },
      photo: null,
      removePhoto: false,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Updated Name')
    expect(wrapper.text()).toContain('Updated Designation')
    expect(
      wrapper.find('.profile-panel__responsibilities li').text(),
    ).toBe('Updated responsibility')

    account.hydrate({ profile: { photoUrl: 'blob:updated-avatar' } })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('img').attributes('src')).toBe('blob:updated-avatar')
    wrapper.unmount()
  })
})
