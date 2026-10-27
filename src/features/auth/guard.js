import { hasAuthSession } from './session'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isDevAuthBypassEnabled({
  isDev = import.meta.env.DEV,
  setting = import.meta.env.VITE_DEV_AUTH_BYPASS,
  hostname = globalThis.location?.hostname,
} = {}) {
  return isDev && setting === 'true' && LOCAL_HOSTNAMES.has(hostname)
}

export function getRootRedirect() {
  return isDevAuthBypassEnabled() ? '/app' : '/login'
}

export function installAuthGuard(router) {
  const devAuthBypassEnabled = isDevAuthBypassEnabled()

  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !devAuthBypassEnabled && !hasAuthSession()) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.meta.guestOnly && hasAuthSession()) {
      return { name: 'home' }
    }
  })
}
