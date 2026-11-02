# Channels module (11 list, 12 management, 13 header)

Everything lives in ONE new folder: `src/modules/channels/`.

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

## Live API

The API client uses the active company and team from `useTeamsStore()` to build
`/v1/{company}/teams/{team}/channels...` paths. It sends the session token as a
Bearer token. Set `VITE_CHANNELS_USE_MOCK=false` to use it; this is enabled in
`.env.development`.

| Action                    | Request                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| List channels             | `GET /v1/{company}/teams/{team}/channels`                                                |
| Search/browse channels    | `GET /v1/{company}/teams/{team}/channels?q={query}`                                      |
| Create                    | `POST /v1/{company}/teams/{team}/channels` with `{ name, description, type: "private" | "public" }` |
| Get channel               | `GET /v1/{company}/teams/{team}/channels/{channel}`                                      |
| Update                    | `PATCH /v1/{company}/teams/{team}/channels/{channel}` with `{ name, description }`       |
| Delete                    | `DELETE /v1/{company}/teams/{team}/channels/{channel}`                                  |
| List members              | `GET /v1/{company}/teams/{team}/channels/{channel}/members`                             |
| Add member                | `POST /v1/{company}/teams/{team}/channels/{channel}/members` with `{ user_id }`          |
| Join                      | `POST /v1/{company}/teams/{team}/channels/{channel}/join`                               |
| Remove member             | `DELETE /v1/{company}/teams/{team}/channels/{channel}/members/{targetUser}`             |
| Leave                     | `DELETE /v1/{company}/teams/{team}/channels/{channel}/leave`                            |

Non-2xx responses should include `{ "message": "human readable text" }`; the
client surfaces that message. Favorite, mute, unread, and archive actions are
not shown because no matching endpoints were included in the supplied API
contract.

## Design decisions you can change in one place

- Sidebar shows 6 channels (`SIDEBAR_MAX_VISIBLE`), the active one is always visible. "More channels" opens a search/join dialog.
- Default channels (e.g. Announcements) can't be left or deleted; edit/delete only appear when `canManage` is true.
- Channel visibility (public/private) is chosen at creation and locked afterwards (edit form disables the toggle).
- Real-time (new channel, member joined): the socket owner can call `useChannelsStore().upsertChannel / removeChannel`.
- Colors are `--ch-*` variables in `styles/tokens.css`.
