# Channels

The Channels feature loads and updates channel data through the backend API. It
uses the active company and team from `useTeamsStore()` to build requests under
`/v1/{company}/teams/{team}/channels`. Set `VITE_API_BASE_URL` to the backend
API root. There is no in-memory channel data source.

## API requests

| Action         | Request |
| -------------- | ------- |
| List channels  | `GET /v1/{company}/teams/{team}/channels` |
| Browse/search  | `GET /v1/{company}/teams/{team}/channels?q={query}` |
| Create         | `POST /v1/{company}/teams/{team}/channels` with `{ name, description, type }` |
| Get            | `GET /v1/{company}/teams/{team}/channels/{channel}` |
| Update         | `PATCH /v1/{company}/teams/{team}/channels/{channel}` with `{ name, description }` |
| Delete         | `DELETE /v1/{company}/teams/{team}/channels/{channel}` |
| List members   | `GET /v1/{company}/teams/{team}/channels/{channel}/members` |
| Add member     | `POST /v1/{company}/teams/{team}/channels/{channel}/members` with `{ user_id }` |
| Join           | `POST /v1/{company}/teams/{team}/channels/{channel}/join` |
| Remove member  | `DELETE /v1/{company}/teams/{team}/channels/{channel}/members/{targetUser}` |
| Leave          | `DELETE /v1/{company}/teams/{team}/channels/{channel}/leave`   |

Non-2xx responses should include `{ "message": "human readable text" }`; the
client surfaces that message. Favorite, mute, unread, and archive actions are
not shown because no matching endpoints were included in the supplied API
contract.

## Behavior

- The sidebar shows up to 6 channels and keeps the active channel visible.
- "More channels" opens the search and join dialog.
- Default channels cannot be left or deleted.
- Channel creation chooses public or private visibility; editing does not
  change visibility.
- A socket owner can update real-time state with
  `useChannelsStore().upsertChannel` and `removeChannel`.
