import { hasAuthSession } from './session'

export function installAuthGuard(router) {
  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !hasAuthSession()) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.meta.guestOnly && hasAuthSession()) {
      return { name: 'home' }
    }
  })
}
