<template>
  <div class="login-view">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>🏢 샤브올데이 출퇴근 관리</h1>
          <p>로그인하여 서비스를 이용하세요</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="name" class="form-label form-label-required">이름</label>
            <input 
              id="name"
              type="text" 
              v-model="loginForm.name"
              placeholder="이름을 입력하세요"
              required
              :disabled="authStore.loading"
              class="form-control"
              :class="{ 'is-invalid': error && error.includes('이름') }"
            >
          </div>

          <div class="form-group">
            <label for="phoneLastFour" class="form-label form-label-required">휴대폰 뒷4자리</label>
            <input 
              id="phoneLastFour"
              type="text" 
              v-model="loginForm.phoneLastFour"
              placeholder="휴대폰 뒷4자리를 입력하세요"
              required
              maxlength="4"
              pattern="[0-9]{4}"
              :disabled="authStore.loading"
              @input="validatePhoneInput"
              class="form-control"
              :class="{ 
                'is-invalid': error && (error.includes('휴대폰') || error.includes('뒷4자리')), 
                'is-valid': loginForm.phoneLastFour.length === 4 && /^\d{4}$/.test(loginForm.phoneLastFour)
              }"
            >
          </div>

          <button 
            type="submit" 
            class="btn btn-primary btn-lg"
            :class="{ 'btn-loading': authStore.loading }"
            :disabled="authStore.loading || !isFormValid"
            style="width: 100%; margin-top: 0.5rem;"
          >
            <span v-if="!authStore.loading">🔐 로그인</span>
            <span v-else>로그인 중...</span>
          </button>
        </form>

        <div v-if="error" class="alert alert-danger alert-icon">
          <div class="alert-icon-content">⚠️</div>
          <div>{{ error }}</div>
        </div>

        <!-- 테스트 계정 안내 -->
        <div class="demo-accounts">
          <h3>테스트 계정</h3>
          <div class="account-list">
            <div class="account-item">
              <strong>홍길동</strong>
              <span>1234</span>
            </div>
            <div class="account-item">
              <strong>김철수</strong>
              <span>5432</span>
            </div>
            <div class="account-item">
              <strong>이영희</strong>
              <span>9876</span>
            </div>
            <div class="account-item">
              <strong>박민수</strong>
              <span>1111</span>
            </div>
          </div>
          <p class="demo-note">
            * 실제 직원 정보는 관리자에게 문의하세요
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

export default {
  name: 'LoginView',
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()
    
    return {
      authStore,
      router
    }
  },
  data() {
    return {
      loginForm: {
        name: '',
        phoneLastFour: ''
      },
      error: null
    }
  },
  computed: {
    isFormValid() {
      return this.loginForm.name.trim().length > 0 && 
             this.loginForm.phoneLastFour.length === 4 &&
             /^\d{4}$/.test(this.loginForm.phoneLastFour)
    }
  },
  methods: {
    validatePhoneInput(event) {
      // 숫자만 입력 허용
      const value = event.target.value.replace(/[^0-9]/g, '')
      if (value.length <= 4) {
        this.loginForm.phoneLastFour = value
      }
    },
    
    async handleLogin() {
      this.error = null
      
      // 폼 유효성 검사
      if (!this.isFormValid) {
        this.error = '이름과 휴대폰 뒷4자리를 정확히 입력해주세요'
        return
      }
      
      try {
        const user = await this.authStore.login(
          this.loginForm.name.trim(), 
          this.loginForm.phoneLastFour
        )
        
        // 역할에 따라 리다이렉트
        if (user.role === 'admin') {
          this.router.push('/admin')
        } else {
          this.router.push('/employee')
        }
        
      } catch (error) {
        this.error = error.message
        
        // 폼 초기화 (보안상 휴대폰 번호만)
        this.loginForm.phoneLastFour = ''
      }
    }
  },
  
  // 컴포넌트가 마운트될 때 이미 로그인된 상태라면 리다이렉트
  mounted() {
    if (this.authStore.isAuthenticated) {
      const user = this.authStore.user
      if (user.role === 'admin') {
        this.router.push('/admin')
      } else {
        this.router.push('/employee')
      }
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/views/login.css';
</style>