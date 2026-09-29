import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import './enhancements.css'
import './productivity.css'

const updateSW = registerSW({
  onNeedRefresh() { window.dispatchEvent(new CustomEvent('momentum:update-ready')) },
  onOfflineReady() { window.dispatchEvent(new CustomEvent('momentum:offline-ready')) }
})
window.__momentumUpdate = updateSW

createApp(App).mount('#app')
