# Role 9 — Search, Reminders, Channel members (Salman Zahoor)

## Home view integration

`src/views/HomeView.vue` mounts the channel header actions, search panel, reminders panel, channel settings modal, and reminder modal. It also starts and stops the reminder watcher and displays reminder toasts. The active channel comes from the shared UI store in `src/stores/ui.js`.

Channel messages for Text, File, and Link search are loaded page-by-page from the active team's channel message API. Text searches pass the term as the message-body query; File and Link searches load API message pages and filter their attachments and URLs locally, so file names are not incorrectly treated as message-body queries. Search does not use the `whistleit:channel-messages` browser-storage cache or mock file results. `search.js` applies the selected filters to the supplied API messages. Member search remains a mock implementation; reminder list/create/delete actions use `/v1/reminders` in `remindersApi.js`, and deleted reminder history remains in browser storage.

Direct-message results for Text, File, and Link search are also loaded page-by-page from `/v1/{company}/direct-channels/{channel}/messages`. Text search sends its term as `body`; File and Link search filters attachments and URLs from the API response pages locally. Search does not use the DM store's browser-storage cache.

Channel poll history is loaded from `GET /v1/polls` and filtered to the selected channel. The legacy `whistleit:channel-poll-history` local-storage cache is removed and is no longer used as a poll-history source.
