import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loginViaInvitation, registerViaInvitation } from './api'
import { saveAuthToken } from './session'
import InvitationAuthView from './InvitationAuthView.vue'

vi.mock('./api', () => ({
  loginViaInvitation: vi.fn(),
  registerViaInvitation: vi.fn(),
}))

vi.mock('./session', () => ({
  saveAuthToken: vi.fn(),
}))

async function mountInvitationView(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/invitation/register/:token',
        name: 'invitation-register',
        component: InvitationAuthView,
      },
      {
        path: '/invitation/login/:token',
        name: 'invitation-login',
        component: InvitationAuthView,
      },
      { path: '/app', name: 'home', component: { template: '<main>Workspace</main>' } },
      { path: '/login', name: 'login', component: { template: '<main>Login</main>' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return { router, wrapper: mount(InvitationAuthView, { global: { plugins: [router] } }) }
}

describe('invitation auth view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerViaInvitation.mockResolvedValue({})
    loginViaInvitation.mockResolvedValue({ access_token: 'invite-session-token' })
    saveAuthToken.mockReturnValue('invite-session-token')
  })

  it('prefills the invited email and registers without a company field', async () => {
    const { router, wrapper } = await mountInvitationView(
      '/invitation/register/invite-token?email=sam%40example.com',
    )

    expect(wrapper.get('#invite-email').element.value).toBe('sam@example.com')
    expect(wrapper.find('[name="company"]').exists()).toBe(false)

    await wrapper.get('#invite-name').setValue('Sam Example')
    await wrapper.get('#invite-password').setValue('secure-password')
    await wrapper.get('#invite-confirm-password').setValue('secure-password')
    await wrapper.get('[name="terms"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(registerViaInvitation).toHaveBeenCalledWith('invite-token', {
      name: 'Sam Example',
      email: 'sam@example.com',
      password: 'secure-password',
      password_confirmation: 'secure-password',
      frontend_url: window.location.origin,
    })
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query).toEqual({ registered: 'true' })
    expect(loginViaInvitation).not.toHaveBeenCalled()
  })

  it('logs in existing users using the invitation token', async () => {
    const { router, wrapper } = await mountInvitationView(
      '/invitation/login/invite-token?email=sam%40example.com',
    )

    await wrapper.get('#invite-password').setValue('secure-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(loginViaInvitation).toHaveBeenCalledWith('invite-token', {
      email: 'sam@example.com',
      password: 'secure-password',
    })
    expect(saveAuthToken).toHaveBeenCalledWith({ access_token: 'invite-session-token' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('stores the session and opens the workspace if registration returns an access token', async () => {
    registerViaInvitation.mockResolvedValueOnce({ access_token: 'registered-session-token' })
    const { router, wrapper } = await mountInvitationView(
      '/invitation/register/invite-token?email=sam%40example.com',
    )

    await wrapper.get('#invite-name').setValue('Sam Example')
    await wrapper.get('#invite-password').setValue('secure-password')
    await wrapper.get('#invite-confirm-password').setValue('secure-password')
    await wrapper.get('[name="terms"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(saveAuthToken).toHaveBeenCalledWith({ access_token: 'registered-session-token' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('shows and hides the password on invitation login', async () => {
    const { wrapper } = await mountInvitationView('/invitation/login/invite-token')
    const password = wrapper.get('#invite-password')

    expect(password.attributes('type')).toBe('password')
    await wrapper.get('[aria-label="Show password"]').trigger('click')
    expect(password.attributes('type')).toBe('text')
    await wrapper.get('[aria-label="Hide password"]').trigger('click')
    expect(password.attributes('type')).toBe('password')
  })

  it('toggles registration password fields independently', async () => {
    const { wrapper } = await mountInvitationView('/invitation/register/invite-token')

    await wrapper.get('[aria-label="Show password"]').trigger('click')
    expect(wrapper.get('#invite-password').attributes('type')).toBe('text')
    expect(wrapper.get('#invite-confirm-password').attributes('type')).toBe('password')

    await wrapper.get('[aria-label="Show confirm password"]').trigger('click')
    expect(wrapper.get('#invite-confirm-password').attributes('type')).toBe('text')
    await wrapper.get('[aria-label="Hide password"]').trigger('click')
    expect(wrapper.get('#invite-password').attributes('type')).toBe('password')
    expect(wrapper.get('#invite-confirm-password').attributes('type')).toBe('text')
  })

  it('resets password visibility when switching between invite login and registration', async () => {
    const { router, wrapper } = await mountInvitationView('/invitation/login/invite-token')

    await wrapper.get('[aria-label="Show password"]').trigger('click')
    await router.push('/invitation/register/invite-token')
    await flushPromises()

    expect(wrapper.get('#invite-password').attributes('type')).toBe('password')
    expect(wrapper.get('#invite-confirm-password').attributes('type')).toBe('password')
  })
})
