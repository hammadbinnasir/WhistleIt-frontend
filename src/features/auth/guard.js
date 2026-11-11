import { hasAuthSession, saveAuthRedirect } from './session'

export function installAuthGuard(router) {
  let protectedHistoryBoundaryAdded = false
  let backNavigationGuardInstalled = false

  function installBackNavigationGuard() {
    if (backNavigationGuardInstalled || typeof window === 'undefined') return

    window.addEventListener(
      'popstate',
      (event) => {
        const currentRoute = router.currentRoute.value
        if (
          !hasAuthSession() ||
          !currentRoute.meta.requiresAuth ||
          event.state?.current !== currentRoute.fullPath
        ) {
          return
        }

        event.stopImmediatePropagation()
        window.history.pushState(event.state, '', window.location.href)
      },
      true,
    )
    backNavigationGuardInstalled = true
  }

  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !hasAuthSession()) {
      saveAuthRedirect(to.fullPath)
      return { name: 'login' }
    }

    if ((to.meta.guestOnly || to.name === 'login') && hasAuthSession()) {
      return { name: 'home' }
    }
  })

  router.afterEach((to, _from, failure) => {
    if (failure) return

    if (!to.meta.requiresAuth || !hasAuthSession()) {
      protectedHistoryBoundaryAdded = false
      return
    }

    if (
      typeof window === 'undefined' ||
      protectedHistoryBoundaryAdded ||
      window.history.state?.current !== to.fullPath
    ) {
      return
    }

    installBackNavigationGuard()
    window.history.pushState(window.history.state, '', window.location.href)
    protectedHistoryBoundaryAdded = true
  })
}
