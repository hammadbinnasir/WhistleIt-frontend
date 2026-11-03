import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { installAuthGuard } from './guard'
import { clearAuthSession, saveAuthToken } from './session'

const EmptyPage = { template: '<div />' }

function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: EmptyPage, meta: { guestOnly: true } },
      { path: '/signup', name: 'signup', component: EmptyPage, meta: { guestOnly: true } },
      { path: '/app', name: 'home', component: EmptyPage, meta: { requiresAuth: true } },
      {
        path: '/app/:workspaceId/:teamId?/:channelId?',
        name: 'workspace-team',
        component: EmptyPage,
        meta: { requiresAuth: true },
      },
    ],
  })
  installAuthGuard(router)
  return router
}

describe('auth route guard', () => {
  beforeEach(() => {
    clearAuthSession()
  })

  it('redirects unauthenticated users away from protected routes', async () => {
    const router = createTestRouter()

    await router.push('/app')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/app')
  })

  it('redirects unauthenticated users away from workspace routes', async () => {
    const router = createTestRouter()
    const requestedPath = '/app/workspace-1/team-2/channel-3'

    await router.push(requestedPath)

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe(requestedPath)
  })

  it('redirects authenticated users away from login and signup pages', async () => {
    saveAuthToken({ token: 'valid-token' })
    const router = createTestRouter()

    await router.push('/signup')

    expect(router.currentRoute.value.name).toBe('home')
  })
})
