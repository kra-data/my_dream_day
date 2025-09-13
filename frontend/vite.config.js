import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // SPA 라우팅을 위한 개발 서버 설정
  server: {
    historyApiFallback: {
      rewrites: [
        // 모든 라우트를 index.html로 fallback
        { from: /.*/, to: '/index.html' }
      ]
    }
  },
  // 프로덕션 빌드 시에도 SPA fallback 지원
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url))
      }
    },
    // 빌드 시 public 폴더 파일들이 dist로 복사되도록 보장
    copyPublicDir: true
  }
})
