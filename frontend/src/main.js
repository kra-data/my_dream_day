import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 전역 스타일 적용
import './assets/main.css'

const app = createApp(App)

// Pinia 상태관리 사용
const pinia = createPinia()
app.use(pinia)

// Vue Router 사용
app.use(router)

// 전역 속성 등록 (필요시)
app.config.globalProperties.$log = console.log

// 전역 에러 핸들러
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue 에러:', err, info)
  // 에러 리포팅 서비스에 보내기 (예: Sentry)
}

// 앱 마운트
app.mount('#app')

// 개발 환경에서만 Vue DevTools 활성화
if (import.meta.env.DEV) {
  console.log('🔧 개발 모드로 실행 중')
}