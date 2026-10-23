# Role 9 — Search, Reminders, Channel members (Salman Zahoor)

## Home view integration

`src/views/HomeView.vue` mounts the channel header actions, search panel, reminders panel, channel settings modal, and reminder modal. It also starts and stops the reminder watcher and displays reminder toasts. The active channel comes from the shared UI store in `src/stores/ui.js`.

The search and member APIs are mock implementations in this folder (`search.js` and `members.js`). Files uploaded by chat should be added to File search with `addMockFile({...})` from `search.js` while mock data is in use. The reminder data and actions are in `reminders.js`.
