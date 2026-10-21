import { CHANNEL_ROUTE_NAME } from './constants'

// Add these to your router (see README, step 2).
// `:channelId?` is optional: /channels redirects to the default channel.
export const channelRoutes = [
  {
    path: '/channels/:channelId?',
    name: CHANNEL_ROUTE_NAME,
    component: () => import('./views/ChannelView.vue'),
    meta: { requiresAuth: true }, // keep/rename to match your existing auth guard convention
  },
]
