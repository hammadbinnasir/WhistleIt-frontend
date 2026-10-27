import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRootRedirect, installAuthGuard, isDevAuthBypassEnabled } from './guard'
import { clearAuthSession, saveAuthToken } from './session'

const EmptyPage = { template: '<div />' }

function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: EmptyPage, meta: { guestOnly: true } },
      { path: '/signup', name: 'signup', component: EmptyPage, meta: { guestOnly: true } },
      { path: '/app', name: 'home', component: EmptyPage, meta: { requiresAuth: true } },
    ],
  })
  installAuthGuard(router)
  return router
}

describe('auth route guard', () => {
  beforeEach(() => {
    clearAuthSession()
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects unauthenticated users away from protected routes', async () => {
    const router = createTestRouter()

    await router.push('/app')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/app')
  })

  it('redirects authenticated users away from login and signup pages', async () => {
    saveAuthToken({ token: 'valid-token' })
    const router = createTestRouter()

    await router.push('/signup')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('allows protected routes with the explicit bypass setting in local development', async () => {
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'true')
    const router = createTestRouter()

    await router.push('/app')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('starts at the app when the local development bypass is enabled', () => {
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'true')

    expect(getRootRedirect()).toBe('/app')
  })

  it('keeps login as the default entry when the bypass is disabled', () => {
    expect(getRootRedirect()).toBe('/login')
  })

  it('does not allow the bypass outside development mode', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'true')
    const router = createTestRouter()

    await router.push('/app')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/app')
  })

  it('does not allow the bypass on non-loopback hosts', () => {
    expect(
      isDevAuthBypassEnabled({
        isDev: true,
        setting: 'true',
        hostname: '192.168.1.10',
      }),
    ).toBe(false)
  })
})
