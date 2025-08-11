<template>
  <div id="app">
    <!-- 로그인하지 않은 경우 네비게이션 숨김 -->
    <nav v-if="isAuthenticated" class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <router-link :to="homeRoute" class="brand-link">
            📱 출퇴근 시스템
          </router-link>
        </div>
        
        <div class="nav-menu" :class="{ 'nav-menu-active': isMobileMenuOpen }">
          <!-- 관리자 메뉴 -->
          <template v-if="user?.role === 'admin'">
            <router-link 
              to="/admin" 
              class="nav-link"
              @click="closeMobileMenu"
            >
              📊 대시보드
            </router-link>
            <router-link 
              to="/admin/salary" 
              class="nav-link"
              @click="closeMobileMenu"
            >
              💰 급여관리
            </router-link>
            <router-link 
              to="/attendance" 
              class="nav-link"
              @click="closeMobileMenu"
            >
              📱 출퇴근
            </router-link>
          </template>
          
          <!-- 직원 메뉴 -->
          <template v-if="user?.role === 'employee'">
            <router-link 
              to="/employee" 
              class="nav-link"
              @click="closeMobileMenu"
            >
              🏠 홈
            </router-link>
          </template>
        </div>

        <div class="nav-user">
          <span class="user-name">{{ user?.name }}님</span>
          <button @click="logout" class="logout-btn">
            🚪 로그아웃
          </button>
        </div>

        <!-- 모바일 햄버거 메뉴 -->
        <div class="nav-toggle" @click="toggleMobileMenu">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </div>
      </div>
    </nav>

    <!-- 메인 콘텐츠 영역 -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- 로그인한 경우에만 푸터 표시 -->
    <footer v-if="isAuthenticated" class="footer">
      <div class="footer-content">
        <p>&copy; 2025 마이드림데이 All rights reserved.</p>
        <div class="footer-links">
          <a href="#" class="footer-link">점장님께 문의하세요.</a>
          <a href="#" class="footer-link">문의: 문지언</a>
        </div>
      </div>
    </footer>

    <!-- 로딩 오버레이 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>처리 중...</p>
      </div>
    </div>

    <!-- 알림 토스트 -->
    <div v-if="notification" class="notification" :class="notification.type">
      <div class="notification-content">
        <span class="notification-icon">
          {{ notification.type === 'success' ? '✅' : '❌' }}
        </span>
        <span class="notification-message">{{ notification.message }}</span>
        <button @click="closeNotification" class="notification-close">×</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'App',
  setup() {
    const authStore = useAuthStore()
    const attendanceStore = useAttendanceStore()
    return { authStore, attendanceStore }
  },
  data() {
    return {
      isMobileMenuOpen: false,
      notification: null
    }
  },
  computed: {
    isAuthenticated() {
      return this.authStore.isAuthenticated
    },
    user() {
      return this.authStore.user
    },
    isLoading() {
      return this.authStore.loading || this.attendanceStore.loading
    },
    homeRoute() {
      return this.user?.role === 'admin' ? '/admin' : '/employee'
    }
  },
  mounted() {
    // 앱 시작시 인증 상태 확인
    this.authStore.checkAuth()
    
    // 전역 에러 핸들링
    window.addEventListener('error', this.handleGlobalError)
    window.addEventListener('unhandledrejection', this.handleGlobalError)
  },
  beforeUnmount() {
    window.removeEventListener('error', this.handleGlobalError)
    window.removeEventListener('unhandledrejection', this.handleGlobalError)
  },
  methods: {
    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen
    },

    closeMobileMenu() {
      this.isMobileMenuOpen = false
    },

    logout() {
      if (confirm('로그아웃 하시겠습니까?')) {
        this.authStore.logout()
        this.$router.push('/login')
      }
    },

    showNotification(message, type = 'success') {
      this.notification = { message, type }
      
      setTimeout(() => {
        this.closeNotification()
      }, 3000)
    },

    closeNotification() {
      this.notification = null
    },

    handleGlobalError(error) {
      console.error('전역 에러:', error)
      this.showNotification('오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error')
    }
  },
  
  watch: {
    $route(to, from) {
      this.closeMobileMenu()
      
      const titles = {
        '/login': '로그인 - 출퇴근 시스템',
        '/employee': '직원 홈 - 출퇴근 시스템',
        '/admin': '관리자 - 출퇴근 시스템',
        '/admin/salary': '급여 관리 - 출퇴근 시스템',
        '/attendance': '출퇴근 - 출퇴근 시스템'
      }
      
      document.title = titles[to.path] || '출퇴근 시스템'
    }
  }
}
</script>

<style>
/* 🎨 App.vue 스타일은 main.css에서 관리됩니다 */
/* 추가적인 컴포넌트별 스타일이 필요한 경우에만 여기에 작성하세요 */
</style>