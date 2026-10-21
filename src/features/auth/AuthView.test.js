import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import AuthView from './AuthView.vue'

async function mountAuthView(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: AuthView },
      { path: '/signup', component: AuthView },
      { path: '/app', name: 'home', component: { template: '<main>Workspace</main>' } },
    ],
  })
  await router.push(path)
  await router.isReady()

  return { router, wrapper: mount(AuthView, { global: { plugins: [router] } }) }
}

describe('auth view', () => {
  it('shows login and switches to account creation', async () => {
    const { router, wrapper } = await mountAuthView()

    expect(wrapper.get('h1').text()).toBe('Log in')
    expect(wrapper.find('input[name="rememberMe"]').exists()).toBe(true)

    await router.push('/signup')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Create Account')
    expect(wrapper.find('input[name="organization"]').exists()).toBe(true)
    expect(wrapper.find('input[name="terms"]').exists()).toBe(true)
  })

  it('shows and hides the password', async () => {
    const { wrapper } = await mountAuthView()
    const password = wrapper.get('#password')

    expect(password.attributes('type')).toBe('password')
    await wrapper.get('button[aria-label="Show password"]').trigger('click')
    expect(password.attributes('type')).toBe('text')
  })

  it('navigates to the workspace after a valid login form submission', async () => {
    const { router, wrapper } = await mountAuthView()

    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('correct-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('navigates to the workspace after a valid account creation form submission', async () => {
    const { router, wrapper } = await mountAuthView('/signup')

    await wrapper.get('#full-name').setValue('Sam Example')
    await wrapper.get('#company').setValue('Example Co')
    await wrapper.get('#email').setValue('sam@example.com')
    await wrapper.get('#password').setValue('correct-password')
    await wrapper.get('#confirm-password').setValue('correct-password')
    await wrapper.get('#terms').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
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
