import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import AppIcon from './components/common/AppIcon.vue'
import './assets/styles/main.css'

const app = createApp(App)
app.component('AppIcon', AppIcon)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.config.globalProperties.$log = console.log

app.config.errorHandler = (err, vm, info) => {
  console.error('Vue 에러:', err, info)
  // 에러 리포팅 서비스에 보내기 (예: Sentry)
}
app.mount('#app')

if (import.meta.env.DEV) {
  console.log('개발 모드로 실행 중')
}