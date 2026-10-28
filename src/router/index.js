import { createRouter, createWebHistory } from 'vue-router'
import { installAuthGuard } from '@/features/auth/guard'
import AuthView from '@/features/auth/AuthView.vue'
import EmailVerificationView from '@/features/auth/EmailVerificationView.vue'
import HomeView from '@/views/HomeView.vue'
import { channelRoutes } from '@/features/channels/routes'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

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
    {
      path: '/forgetpassword/:token',
      redirect: (to) => ({
        path: '/reset-password',
        query: { ...to.query, token: to.params.token },
      }),
    },
    {
      path: '/forgetpassword:token',
      redirect: (to) => ({
        path: '/reset-password',
        query: { ...to.query, token: to.params.token },
      }),
    },
    { path: '/verify-email/:token?', name: 'verify-email', component: EmailVerificationView },
    {
      path: '/api/auth/verify/:token?',
      redirect: (to) => ({
        path: '/verify-email',
        query: { token: to.params.token || to.query.token },
      }),
    },
    { path: '/app', name: 'home', component: HomeView },
    {
      path: '/app/:workspaceId/:teamId?/:channelId?',
      name: 'workspace-team',
      component: HomeView,
    },
    ...channelRoutes,
  ],
})

installAuthGuard(router)

router.beforeEach(async (to) => {
  if (to.name !== 'home' && to.name !== 'workspace-team') return true

  const teamsStore = useTeamsStore()
  const uiStore = useUiStore()
  if (!teamsStore.workspaces.length) await teamsStore.fetchWorkspaces()
  if (teamsStore.error) return true

  const workspaces = teamsStore.workspaces
  if (!workspaces.length) {
    return to.name === 'home' ? true : { name: 'home' }
  }

  const requestedWorkspace =
    to.name === 'workspace-team'
      ? workspaces.find((workspace) => String(workspace.id) === String(to.params.workspaceId))
      : teamsStore.activeWorkspace
  const workspace = requestedWorkspace ?? workspaces[0]

  if (
    teamsStore.activeWorkspaceId !== workspace.id ||
    !teamsStore.teamsByWorkspaceId[workspace.id]
  ) {
    await teamsStore.selectWorkspace(workspace.id)
  }
  if (teamsStore.error) return true

  const workspaceTeams = teamsStore.teamsByWorkspaceId[workspace.id] ?? []
  const requestedTeam =
    to.name === 'workspace-team'
      ? workspaceTeams.find((team) => String(team.id) === String(to.params.teamId))
      : null
  const team = requestedTeam ?? workspaceTeams.find((item) => item.id === teamsStore.activeTeamId)

  if (!team) {
    uiStore.selectChannel(null)
    if (
      to.name !== 'workspace-team' ||
      String(to.params.workspaceId) !== String(workspace.id) ||
      to.params.teamId
    ) {
      return { path: `/app/${encodeURIComponent(workspace.id)}` }
    }
    return true
  }

  teamsStore.selectTeam(team.id)
  if (
    to.name !== 'workspace-team' ||
    String(to.params.workspaceId) !== String(workspace.id) ||
    String(to.params.teamId) !== String(team.id)
  ) {
    return {
      name: 'workspace-team',
      params: { workspaceId: workspace.id, teamId: team.id },
    }
  }

  uiStore.selectChannel(to.params.channelId || null)
  return true
})

if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    const currentRoute = router.currentRoute.value
    if (currentRoute.meta.requiresAuth) {
      router.replace({ name: 'login', query: { redirect: currentRoute.fullPath } })
    }
  })
}

export default router
