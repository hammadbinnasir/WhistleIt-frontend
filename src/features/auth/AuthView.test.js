import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { login, register, requestPasswordReset, resetPassword } from './api'
import { getAuthToken } from './session'
import AuthView from './AuthView.vue'

vi.mock('./api', () => ({
  login: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

async function mountAuthView(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: AuthView },
      { path: '/signup', name: 'signup', component: AuthView },
      { path: '/forgot-password', name: 'forgot-password', component: AuthView },
      { path: '/reset-password', name: 'reset-password', component: AuthView },
      { path: '/app', name: 'home', component: { template: '<main>Workspace</main>' } },
    ],
  })
  await router.push(path)
  await router.isReady()

  return { router, wrapper: mount(AuthView, { global: { plugins: [router] } }) }
}

describe('auth view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    login.mockResolvedValue({ access_token: 'test-token' })
    register.mockResolvedValue({})
    requestPasswordReset.mockResolvedValue({})
    resetPassword.mockResolvedValue({})
  })

  it('shows login and switches to account creation', async () => {
    const { router, wrapper } = await mountAuthView()

    expect(wrapper.get('h1').text()).toBe('Log in')
    expect(wrapper.find('input[name="rememberMe"]').exists()).toBe(true)
    expect(wrapper.get('.auth-background').attributes('src')).toContain('auth-background.svg')

    await wrapper.get('#email').setValue('previous@example.com')
    await wrapper.get('#password').setValue('previous-password')
    await router.push('/signup')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Create Account')
    expect(wrapper.find('input[name="company"]').exists()).toBe(true)
    expect(wrapper.find('input[name="terms"]').exists()).toBe(true)
    expect(wrapper.get('#email').element.value).toBe('')
    expect(wrapper.get('#password').element.value).toBe('')
    expect(wrapper.get('form').attributes('autocomplete')).toBe('off')
    expect(wrapper.get('#email').attributes('autocomplete')).toBe('off')
    expect(wrapper.get('#password').attributes('autocomplete')).toBe('new-password')
  })

  it('shows and hides the password', async () => {
    const { wrapper } = await mountAuthView()
    const password = wrapper.get('#password')

    expect(password.attributes('type')).toBe('password')
    await wrapper.get('button[aria-label="Show password"]').trigger('click')
    expect(password.attributes('type')).toBe('text')
  })

  it('allows the browser to suggest saved credentials on the login page', async () => {
    const { wrapper } = await mountAuthView()

    expect(wrapper.get('form').attributes('autocomplete')).toBe('on')
    expect(wrapper.get('#email').attributes('name')).toBe('username')
    expect(wrapper.get('#email').attributes('autocomplete')).toBe('username')
    expect(wrapper.get('#password').attributes('autocomplete')).toBe('current-password')
  })

  it('sends a password reset request for the entered email', async () => {
    const { router, wrapper } = await mountAuthView('/forgot-password')

    expect(wrapper.get('h1').text()).toBe('Reset Password')
    expect(wrapper.get('.submit-button').text()).toBe('Send Instructions')
    expect(wrapper.get('.auth-switch a').text()).toBe('Back to Login')
    expect(wrapper.find('#password').exists()).toBe(false)
    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(requestPasswordReset).toHaveBeenCalledWith('sam@example.com')
    expect(wrapper.get('[role="status"]').text()).toContain('password reset instructions')
    expect(router.currentRoute.value.path).toBe('/forgot-password')
  })

  it('shows API errors when a password reset request fails', async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error('Reset endpoint unavailable'))
    const { wrapper } = await mountAuthView('/forgot-password')

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Reset endpoint unavailable')
  })

  it('resets the password using the token and email from the reset link', async () => {
    const { router, wrapper } = await mountAuthView(
      '/reset-password?token=reset-token&email=sam%40example.com',
    )

    expect(wrapper.get('h1').text()).toBe('Reset Password')
    expect(wrapper.get('#email').element.value).toBe('sam@example.com')
    expect(wrapper.get('#password').attributes('autocomplete')).toBe('new-password')
    await wrapper.get('#password').setValue('new-password-123')
    await wrapper.get('#confirm-password').setValue('new-password-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(resetPassword).toHaveBeenCalledWith({
      email: 'sam@example.com',
      token: 'reset-token',
      password: 'new-password-123',
      password_confirmation: 'new-password-123',
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Your password has been reset')
    expect(router.currentRoute.value.path).toBe('/reset-password')
  })

  it('does not submit a reset without a token', async () => {
    const { wrapper } = await mountAuthView('/reset-password?email=sam%40example.com')

    await wrapper.get('#password').setValue('new-password-123')
    await wrapper.get('#confirm-password').setValue('new-password-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(resetPassword).not.toHaveBeenCalled()
    expect(wrapper.get('[role="status"]').text()).toContain('invalid or has expired')
  })

  it('rejects mismatched passwords when resetting a password', async () => {
    const { wrapper } = await mountAuthView('/reset-password?token=reset-token')

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('new-password-123')
    await wrapper.get('#confirm-password').setValue('different-password')
    await wrapper.get('form').trigger('submit')

    expect(resetPassword).not.toHaveBeenCalled()
    expect(wrapper.get('[role="status"]').text()).toContain('Passwords do not match')
  })

  it('logs in and navigates to the workspace after a valid form submission', async () => {
    login.mockResolvedValueOnce({ access_token: 'test-token' })
    const { router, wrapper } = await mountAuthView()

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('correct-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(login).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'correct-password',
    })
    expect(getAuthToken()).toBe('test-token')
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('keeps the token across browser restarts when remember me is selected', async () => {
    const { wrapper } = await mountAuthView()

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('correct-password')
    await wrapper.get('[name="rememberMe"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(localStorage.getItem('authToken')).toBe('test-token')
    expect(sessionStorage.getItem('authToken')).toBeNull()
  })

  it('registers and returns to login after a valid account creation form submission', async () => {
    const { router, wrapper } = await mountAuthView('/signup')

    await wrapper.get('#full-name').setValue('Sam Example')
    await wrapper.get('#company').setValue('Example Co')
    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('correct-password')
    await wrapper.get('#confirm-password').setValue('correct-password')
    await wrapper.get('#terms').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(register).toHaveBeenCalledWith({
      name: 'Sam Example',
      company: 'Example Co',
      email: 'sam@example.com',
      password: 'correct-password',
      password_confirmation: 'correct-password',
    })
    expect(router.currentRoute.value.path).toBe('/login')
    expect(wrapper.get('#email').element.value).toBe('')
    expect(wrapper.get('#password').element.value).toBe('')
  })

  it('requires at least eight password characters without setting a maximum on sign up', async () => {
    const { wrapper } = await mountAuthView('/signup')
    const longPassword = 'a'.repeat(256)

    await wrapper.get('#full-name').setValue('Sam Example')
    await wrapper.get('#company').setValue('Example Co')
    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('short7!')
    await wrapper.get('#confirm-password').setValue('short7!')
    await wrapper.get('#terms').setValue(true)
    await wrapper.get('form').trigger('submit')

    expect(register).not.toHaveBeenCalled()
    expect(wrapper.get('#password').element.minLength).toBe(8)
    expect(wrapper.get('#password').attributes('maxlength')).toBeUndefined()
    expect(wrapper.get('#confirm-password').attributes('maxlength')).toBeUndefined()

    await wrapper.get('#password').setValue(longPassword)
    await wrapper.get('#confirm-password').setValue(longPassword)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        password: longPassword,
        password_confirmation: longPassword,
      }),
    )
  })

  it('shows authentication errors and stays on the form', async () => {
    login.mockRejectedValueOnce(new Error('Invalid credentials'))
    const { router, wrapper } = await mountAuthView()

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Invalid credentials')
    expect(wrapper.get('form').element.lastElementChild).toBe(
      wrapper.get('[role="status"]').element,
    )
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('reports a password mismatch during sign up', async () => {
    const { wrapper } = await mountAuthView('/signup')

    await wrapper.get('#full-name').setValue('Sam Example')
    await wrapper.get('#company').setValue('Example Co')
    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('password-one')
    await wrapper.get('#confirm-password').setValue('password-two')
    await wrapper.get('#terms').setValue(true)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="status"]').text()).toContain('Passwords do not match')
  })
})
