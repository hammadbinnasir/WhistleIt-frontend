import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/main.css'

import { useUiStore } from '@/stores/ui'
import { persistPinnedMessages } from '@/stores/pinnedMessagesPersistence'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

persistPinnedMessages(useUiStore(pinia))

app.mount('#app')