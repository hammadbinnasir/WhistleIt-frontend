# WhistleIt Frontend

Real-time team chat web client. **Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS v4**, tested with Vitest.

## Quick start

```bash
git clone https://github.com/hammadbinnasir/WhistleIt-frontend.git
cd WhistleIt-frontend
git checkout Development      # all work starts from Development
npm install
cp .env.example .env.local
npm run dev                   # http://localhost:5173
```

Requires Node 20+ (22 recommended).

## Scripts

| Command                | What it does                  |
| ---------------------- | ----------------------------- |
| `npm run dev`          | Start dev server              |
| `npm run build`        | Production build to `dist/`   |
| `npm test`             | Run unit tests (Vitest)       |
| `npm run lint`         | ESLint                        |
| `npm run format`       | Prettier, auto-fix `src/`     |
| `npm run format:check` | Prettier check (used in CI)   |

## Project structure

```
src/
  assets/          global CSS (Tailwind entry)
  components/      shared, reusable UI components (design system)
  features/        ONE FOLDER PER OWNER AREA (put your views, components, stores here)
    auth/ account/ shell/ channels/ dms/ messages/ composer/ media/ search/
  lib/
    api/           central API client (no fetch in components!)
    socket/        central WebSocket layer
  router/          route definitions
  stores/          shared Pinia stores (ui.js is the example)
  views/           top-level pages
```

Inside your feature folder, keep things together, for example:

```
features/channels/
  components/ChannelList.vue
  stores/channels.js
  views/ChannelView.vue
  routes.js
```

## Pinia in 30 seconds

See `src/stores/ui.js` (store) and `src/views/HomeView.vue` (usage).

```js
// stores/example.js
export const useExampleStore = defineStore('example', () => {
  const count = ref(0)                 // state
  const double = computed(() => count.value * 2) // getter
  function inc() { count.value++ }     // action
  return { count, double, inc }
})
```

- Use Pinia for **UI/client state** (selected channel, panels, drafts).
- Use `storeToRefs(store)` when destructuring state/getters; call actions on the store.
- Test stores with `setActivePinia(createPinia())` (see `ui.test.js`).

## Team workflow

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before your first branch.
