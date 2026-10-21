# Channels module (11 list, 12 management, 13 header)

Everything lives in ONE new folder: `src/modules/channels/`. No existing file is replaced.

## Assumptions

Vue 3 (`<script setup>`), Pinia, Vite, Tailwind in the app shell, the `@` alias, and the shared `src/stores/ui.js`
store (`selectedChannelId`, `selectChannel(id)`). No vue-router is needed: the selected channel lives in that store.
The module touches that store in ONE file only: `composables/useActiveChannel.js`.

## 1. Copy the folder

Copy `channels/` to `src/modules/channels/`.

## 2. Adjust the layout file (the one you pasted, probably `src/App.vue`)

Replace it with the provided `App.vue`. The changes are:

- import `ChannelSidebar` and `ChannelHeader` from `@/modules/channels`
- the demo `channels` array and hand-made list are replaced by `<ChannelSidebar />`
- the `<h2>` channel title is replaced by `<ChannelHeader :channel-id="selectedChannelId">` (the "Hide sidebar" button moves into its `#actions` slot)
- the sidebar uses `v-show` instead of `v-if`, because the Channels dialogs live inside `<ChannelSidebar />` and must stay mounted
  This file is shared, so tell the owner of the layout before changing it.

## 3. Pinia and env

`main.js` must already have `app.use(createPinia())`. Create/extend `.env.development`:

```
VITE_API_BASE_URL=/api
VITE_CHANNELS_USE_MOCK=true     # fake in-memory backend; set to false (or delete) when real APIs exist
```

Messages mount in the empty `<section>` of `App.vue` (owned by the messages teammate).

## Going live when the backend is ready

1. Set `VITE_CHANNELS_USE_MOCK=false`.
2. Adapt `api/http.js` (`getAuthHeaders`, or swap in your existing axios instance).
3. Adjust field names ONLY in `api/normalizers.js` and endpoint paths ONLY in `api/channels.api.js`.

## Proposed API contract (send this to the backend team)

Channel object (camelCase):
`{ id, name, description, isPrivate, isDefault, isArchived, isMember, isFavorite, isMuted, isUnread, unreadCount, memberCount, canManage }`
`isFavorite/isMuted/isUnread/unreadCount` are per-user. `canManage` = current user may edit/archive.

| Action                          | Request                                             | Response                                              |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| My channels (sidebar)           | `GET /channels?joined=true`                         | `[channel]` or `{ items: [channel] }`                 |
| Browse / search (More channels) | `GET /channels/browse?q=`                           | list of public channels + private ones the user is in |
| Create                          | `POST /channels` `{ name, description, isPrivate }` | channel (409 + `{message}` if the name exists)        |
| Edit                            | `PATCH /channels/:id` `{ name, description }`       | channel                                               |
| Join                            | `POST /channels/:id/join`                           | channel                                               |
| Leave                           | `POST /channels/:id/leave`                          | 204 (403 for default channels)                        |
| Archive                         | `POST /channels/:id/archive`                        | 204 (403 for default channels)                        |
| Favorite / unfavorite           | `PUT` / `DELETE /channels/:id/favorite`             | 204                                                   |
| Mute / unmute                   | `PUT` / `DELETE /channels/:id/mute`                 | 204                                                   |
| Mark as unread                  | `POST /channels/:id/unread`                         | 204                                                   |
| Members (header stack)          | `GET /channels/:id/members?limit=10`                | `{ items: [{ id, name, avatarUrl, status: online      | away | offline }], total }` |

Errors: non-2xx with JSON `{ "message": "human readable text" }`; the UI shows `message` to the user.

## Design decisions you can change in one place

- Sidebar shows 6 channels (`SIDEBAR_MAX_VISIBLE`), the active one is always visible; favorites are pinned on top. "More channels" opens a search/join dialog.
- Default channels (e.g. Announcements) can't be left or archived; edit/archive only appear when `canManage` is true.
- Channel visibility (public/private) is chosen at creation and locked afterwards (edit form disables the toggle).
- Real-time (new channel, member joined): the socket owner can call `useChannelsStore().upsertChannel / removeChannel`.
- Colors are `--ch-*` variables in `styles/tokens.css`.
