# Role 9 — Search, Reminders, Channel members (Salman Zahoor)

## Home view integration

`src/views/HomeView.vue` mounts the channel header actions, search panel, reminders panel, channel settings modal, and reminder modal. It also starts and stops the reminder watcher and displays reminder toasts. The active channel comes from the shared UI store in `src/stores/ui.js`.

Channel messages for Text, File, and Link search are loaded page-by-page from the active team's channel message API. Search uses those API response pages directly and does not search the `whistleit:channel-messages` browser-storage cache or composer mock messages. `search.js` applies the selected filters to the supplied messages. Member search remains a mock implementation; reminder list/create/delete actions use `/v1/reminders` in `remindersApi.js`, and deleted reminder history remains in browser storage.

Direct-message results for Text, File, and Link search are also loaded page-by-page from `/v1/{company}/direct-channels/{channel}/messages`. The search term is sent as `body`, and the search filters only API response messages rather than the DM store's browser-storage cache.
