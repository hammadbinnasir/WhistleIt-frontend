import { createRouter, createWebHistory } from 'vue-router'
import { installAuthGuard } from '@/features/auth/guard'
import AuthView from '@/features/auth/AuthView.vue'
import EmailVerificationView from '@/features/auth/EmailVerificationView.vue'
import HomeView from '@/views/HomeView.vue'
import { channelRoutes } from '@/features/channels/routes'

// Each feature owner adds their own routes here (or in features/<area>/routes.js
// and imports them). Keep route names unique.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: AuthView },
    { path: '/signup', name: 'signup', component: AuthView },
    { path: '/forgot-password', name: 'forgot-password', component: AuthView },
    { path: '/reset-password', name: 'reset-password', component: AuthView },
    { path: '/verify-email/:token?', name: 'verify-email', component: EmailVerificationView },
    {
      path: '/api/auth/verify/:token?',
      redirect: (to) => ({
        path: '/verify-email',
        query: { token: to.params.token || to.query.token },
      }),
    },
    { path: '/app', name: 'home', component: HomeView },
    ...channelRoutes,
  ],
})

installAuthGuard(router)

if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    const currentRoute = router.currentRoute.value
    if (currentRoute.meta.requiresAuth) {
      router.replace({ name: 'login', query: { redirect: currentRoute.fullPath } })
    }
  })
}

export default router
