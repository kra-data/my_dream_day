import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/common/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      name: 'home',
      beforeEnter: (to, from, next) => {
        const authStore = useAuthStore()
        authStore.checkAuth()
        
        if (authStore.isAuthenticated && !authStore.isTokenExpired()) {
          if (authStore.user?.role === 'admin') {
            next('/admin')
          } else {
            next('/employee')
          }
        } else {
          next('/login')
        }
      }
    },
    {
      path: '/employee',
      name: 'employee',
      component: () => import('@/views/employee/EmployeeView.vue'),
      meta: { requiresAuth: true, role: 'employee' }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/admin/AdminView.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    },
    // 기존 라우트들은 인증된 사용자만 접근 가능
    // 404 fallback - 모든 정의되지 않은 경로 처리
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      beforeEnter: (to, from, next) => {
        const authStore = useAuthStore()
        authStore.checkAuth()
        
        console.log('404 라우트 접근:', to.path)
        
        // 인증된 사용자인지 확인
        if (authStore.isAuthenticated && !authStore.isTokenExpired()) {
          // 인증된 사용자는 역할에 따라 리다이렉트
          if (authStore.user?.role === 'admin') {
            console.log('인증된 관리자 - /admin으로 리다이렉트')
            next('/admin')
          } else {
            console.log('인증된 직원 - /employee로 리다이렉트')
            next('/employee')
          }
        } else {
          // 인증되지 않은 사용자는 로그인으로
          console.log('인증되지 않은 사용자 - /login으로 리다이렉트')
          next('/login')
        }
      }
    }
  ]
})

// 라우터 가드
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // 인증 상태 확인 (토큰 만료 시 자동 로그아웃 포함)
  if (!authStore.isAuthenticated) {
    authStore.checkAuth()
  } else {
    // 이미 인증된 상태에서도 토큰 만료 확인
    if (authStore.isTokenExpired()) {
      authStore.logout()
    }
  }
  
  const requiresAuth = to.meta.requiresAuth
  const requiredRole = to.meta.role
  const isAuthenticated = authStore.isAuthenticated
  const userRole = authStore.user?.role
  
  if (requiresAuth && !isAuthenticated) {
    // 인증이 필요하지만 로그인하지 않은 경우
    next('/login')
  } else if (requiredRole && userRole !== requiredRole) {
    // 특정 역할이 필요하지만 권한이 없는 경우
    if (userRole === 'admin') {
      next('/admin')
    } else if (userRole === 'employee') {
      next('/employee')
    } else {
      next('/login')
    }
  } else if (to.path === '/login' && isAuthenticated) {
    // 이미 로그인한 사용자가 로그인 페이지에 접근하는 경우
    if (userRole === 'admin') {
      next('/admin')
    } else {
      next('/employee')
    }
  } else {
    next()
  }
})

export default router