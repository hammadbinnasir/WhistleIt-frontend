import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { login, register } from './api'
import { getAuthToken } from './session'
import AuthView from './AuthView.vue'

vi.mock('./api', () => ({
  login: vi.fn(),
  register: vi.fn(),
}))

async function mountAuthView(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: AuthView },
      { path: '/signup', name: 'signup', component: AuthView },
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
    login.mockResolvedValue({})
    register.mockResolvedValue({})
  })

  it('shows login and switches to account creation', async () => {
    const { router, wrapper } = await mountAuthView()

    expect(wrapper.get('h1').text()).toBe('Log in')
    expect(wrapper.find('input[name="rememberMe"]').exists()).toBe(true)

    await router.push('/signup')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Create Account')
    expect(wrapper.find('input[name="company"]').exists()).toBe(true)
    expect(wrapper.find('input[name="terms"]').exists()).toBe(true)
  })

  it('shows and hides the password', async () => {
    const { wrapper } = await mountAuthView()
    const password = wrapper.get('#password')

    expect(password.attributes('type')).toBe('password')
    await wrapper.get('button[aria-label="Show password"]').trigger('click')
    expect(password.attributes('type')).toBe('text')
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
  })

  it('shows authentication errors and stays on the form', async () => {
    login.mockRejectedValueOnce(new Error('Invalid credentials'))
    const { router, wrapper } = await mountAuthView()

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Invalid credentials')
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
