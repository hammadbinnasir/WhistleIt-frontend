import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { invitationRoutes } from './routes'

describe('invitation routes', () => {
  it('redirects legacy email links to the invitation login page with the token', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: invitationRoutes,
    })
    const token = 'd894c1180834c2131061c390f70f7ce9aa40de75082bc5938b34337964bb6493'

    await router.push(`/sendinvitation${token}`)

    expect(router.currentRoute.value.name).toBe('invitation-login')
    expect(router.currentRoute.value.params.token).toBe(token)
  })

  it('preserves an invited email supplied as a query parameter', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: invitationRoutes,
    })

    await router.push('/sendinvitationinvite-token?email=sam%40example.com')

    expect(router.currentRoute.value.name).toBe('invitation-login')
    expect(router.currentRoute.value.params.token).toBe('invite-token')
    expect(router.currentRoute.value.query.email).toBe('sam@example.com')
  })
})
