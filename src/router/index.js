import { createRouter, createWebHistory } from 'vue-router'
import AuthView from '@/features/auth/AuthView.vue'
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
    { path: '/app', name: 'home', component: HomeView },
    ...channelRoutes,
  ],
})

export default router
