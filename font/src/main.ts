import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/globals.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
app.use(createPinia())

useAuthStore().loadFromStorage()

app.use(router)
app.mount('#app')
