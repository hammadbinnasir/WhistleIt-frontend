import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { sendInvitation } from '@/features/auth/api'
import InviteUsersModal from './InviteUsersModal.vue'

vi.mock('@/features/auth/api', () => ({
  sendInvitation: vi.fn(),
}))

describe('InviteUsersModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendInvitation.mockResolvedValue({})
  })

  it('sends an invitation and shows a success message', async () => {
    const wrapper = mount(InviteUsersModal)

    await wrapper.find('input[name="email"]').setValue('sam@example.com')
    await wrapper.find('form').trigger('submit')

    expect(sendInvitation).toHaveBeenCalledWith('sam@example.com')
    expect(wrapper.text()).toContain('Invitation sent to sam@example.com.')
    expect(wrapper.text()).not.toContain('Recently sent')
  })

  it('shows API errors when an invitation fails', async () => {
    sendInvitation.mockRejectedValueOnce(new Error('Invitation endpoint unavailable'))
    const wrapper = mount(InviteUsersModal)

    await wrapper.find('input[name="email"]').setValue('sam@example.com')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('Invitation endpoint unavailable')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })

  it('emits close from its close button', async () => {
    const wrapper = mount(InviteUsersModal)

    await wrapper.get('[aria-label="Close invite people dialog"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
