import InvitationAuthView from './InvitationAuthView.vue'

export const invitationRoutes = [
  {
    path: '/invitation/register/:token',
    name: 'invitation-register',
    component: InvitationAuthView,
  },
  {
    path: '/invitation/login/:token',
    name: 'invitation-login',
    component: InvitationAuthView,
  },
  {
    path: '/sendinvitation:token',
    redirect: (to) => ({
      name: 'invitation-login',
      params: { token: to.params.token },
      query: to.query,
    }),
  },
]
