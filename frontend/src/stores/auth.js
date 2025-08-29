import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import router from '@/router' // router import 추가

// API 베이스 URL 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const isAuthenticated = ref(false)
  const loading = ref(false)
  const accessToken = ref(null)
  const refreshToken = ref(null)

  // Axios 요청 인터셉터 - 모든 요청에 accessToken 추가
  api.interceptors.request.use(
    (config) => {
      if (accessToken.value) {
        config.headers.Authorization = `Bearer ${accessToken.value}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Axios 응답 인터셉터 - 토큰 만료 시 자동 갱신
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        
        try {
          await refreshAccessToken()
          // 새 토큰으로 원래 요청 재시도
          originalRequest.headers.Authorization = `Bearer ${accessToken.value}`
          return api(originalRequest)
        } catch (refreshError) {
          // 리프레시 토큰도 만료된 경우 로그아웃
          logout()
          // 로그인 페이지로 리다이렉트
          router.push('/login')
          return Promise.reject(refreshError)
        }
      }
      
      return Promise.reject(error)
    }
  )

  // JWT 토큰 디코딩 함수
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('JWT 디코딩 실패:', error)
      return null
    }
  }

  // Actions
  const login = async (name, phoneLastFour) => {
    loading.value = true
    try {
      const response = await api.post('/auth/login', {
        name: name.trim(),
        phoneLastFour: phoneLastFour.trim()
      })

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data

      // JWT 토큰에서 사용자 정보 디코딩
      const tokenPayload = decodeJWT(newAccessToken)
      
      if (!tokenPayload) {
        throw new Error('토큰 정보를 읽을 수 없습니다')
      }

      // 사용자 정보 구성
      const userData = {
        userId: tokenPayload.userId,
        shopId: tokenPayload.shopId,
        role: tokenPayload.role,
        name: name.trim(),
        phoneLastFour: phoneLastFour.trim(),
        loginTime: new Date().toISOString(),
        tokenExpiry: tokenPayload.exp ? new Date(tokenPayload.exp * 1000) : null
      }

      // 상태 업데이트
      user.value = userData
      accessToken.value = newAccessToken
      refreshToken.value = newRefreshToken
      isAuthenticated.value = true

      // 로컬 스토리지에 저장
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('accessToken', newAccessToken)
      localStorage.setItem('refreshToken', newRefreshToken)

      // 로그인 후 완전한 직원 정보 조회 시도
      try {
        await fetchCompleteUserData()
      } catch (error) {
        console.warn('완전한 사용자 정보 조회 실패, 기본 정보로 진행:', error)
      }

      return user.value
    } catch (error) {
      console.error('로그인 실패:', error)
      
      // 에러 메시지 처리
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          '로그인에 실패했습니다. 이름과 휴대폰 뒷4자리를 확인해주세요.'
      
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const fetchCompleteUserData = async () => {
    try {
      if (!user.value?.userId || !user.value?.shopId) {
        throw new Error('사용자 기본 정보가 없습니다')
      }

      // 직원 상세 정보 조회
      const response = await api.get(`/admin/shops/${user.value.shopId}/employees`)
      const employees = response.data || []
      
      // 현재 로그인한 사용자 정보 찾기
      const currentEmployee = employees.find(emp => 
        emp.id === user.value.userId || 
        (emp.name === user.value.name && emp.phone?.slice(-4) === user.value.phoneLastFour)
      )

      if (currentEmployee) {
        // 사용자 정보 업데이트
        user.value = {
          ...user.value,
          id: currentEmployee.id,
          empId: currentEmployee.id,
          name: currentEmployee.name,
          position: currentEmployee.position,
          section: currentEmployee.section,
          pay: currentEmployee.pay,
          payUnit: currentEmployee.payUnit,
          phone: currentEmployee.phone,
          bank: currentEmployee.bank,
          accountNumber: currentEmployee.accountNumber,
          nationalId: currentEmployee.nationalId,
          qrCode: currentEmployee.qrCode,
          schedule: currentEmployee.schedule
        }

        // 로컬 스토리지 업데이트
        localStorage.setItem('user', JSON.stringify(user.value))
        
        console.log('완전한 직원 정보 로드 완료:', user.value)
      } else {
        // 직원 정보를 찾지 못한 경우 기본값 설정
        console.warn('직원 정보를 찾지 못함, 기본값으로 설정')
        user.value = {
          ...user.value,
          id: user.value.userId,
          empId: user.value.userId,
          position: 'STAFF',
          section: 'HALL',
          pay: 0,
          payUnit: 'MONTHLY',
          phone: user.value.phoneLastFour ? `010****${user.value.phoneLastFour}` : '',
          bank: '',
          accountNumber: '',
          nationalId: '',
          qrCode: '',
          schedule: {}
        }
        localStorage.setItem('user', JSON.stringify(user.value))
      }
    } catch (error) {
      console.error('완전한 사용자 정보 조회 실패:', error)
      // API 조회 실패 시 기본값으로 설정
      user.value = {
        ...user.value,
        id: user.value.userId,
        empId: user.value.userId,
        position: 'STAFF',
        section: 'HALL',
        pay: 2500000,
        payUnit: 'MONTHLY',
        phone: user.value.phoneLastFour ? `010****${user.value.phoneLastFour}` : '',
        bank: '미등록',
        accountNumber: '',
        nationalId: '',
        qrCode: '1',
        schedule: {
          mon: { start: '09:00', end: '18:00' },
          tue: { start: '09:00', end: '18:00' },
          wed: { start: '09:00', end: '18:00' },
          thu: { start: '09:00', end: '18:00' },
          fri: { start: '09:00', end: '18:00' },
          sat: { start: '', end: '' },
          sun: { start: '', end: '' }
        }
      }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  const refreshAccessToken = async () => {
    try {
      if (!refreshToken.value) {
        throw new Error('리프레시 토큰이 없습니다')
      }

      const response = await api.post('/auth/refresh', {
        token: refreshToken.value
      })

      const { accessToken: newAccessToken } = response.data
      accessToken.value = newAccessToken
      
      // 새 토큰에서 사용자 정보 업데이트
      const tokenPayload = decodeJWT(newAccessToken)
      if (tokenPayload && user.value) {
        user.value = {
          ...user.value,
          userId: tokenPayload.userId,
          shopId: tokenPayload.shopId,
          role: tokenPayload.role,
          tokenExpiry: tokenPayload.exp ? new Date(tokenPayload.exp * 1000) : null
        }
        localStorage.setItem('user', JSON.stringify(user.value))
      }
      
      // 로컬 스토리지 업데이트
      localStorage.setItem('accessToken', newAccessToken)
      
      return newAccessToken
    } catch (error) {
      console.error('토큰 갱신 실패:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // 서버에 로그아웃 요청 (리프레시 토큰 무효화)
      if (refreshToken.value) {
        await api.post('/auth/logout', {
          token: refreshToken.value
        })
      }
    } catch (error) {
      console.error('로그아웃 요청 실패:', error)
      // 서버 요청이 실패해도 로컬에서는 로그아웃 처리
    } finally {
      // 상태 초기화
      user.value = null
      accessToken.value = null
      refreshToken.value = null
      isAuthenticated.value = false
      
      // 로컬 스토리지 정리
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')

      // 로그인 페이지로 리다이렉트 (현재 라우트가 로그인이 아닌 경우에만)
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
    }
  }

  const checkAuth = () => {
    try {
      const savedUser = localStorage.getItem('user')
      const savedAccessToken = localStorage.getItem('accessToken')
      const savedRefreshToken = localStorage.getItem('refreshToken')
      
      if (savedUser && savedAccessToken && savedRefreshToken) {
        const parsedUser = JSON.parse(savedUser)
        
        // 저장된 토큰에서 최신 정보 확인
        const tokenPayload = decodeJWT(savedAccessToken)
        
        if (tokenPayload) {
          // 토큰 만료 확인
          const currentTime = Math.floor(Date.now() / 1000)
          if (tokenPayload.exp && tokenPayload.exp < currentTime) {
            // 토큰이 만료된 경우 로그아웃 처리
            logout()
            return
          }
          
          // 토큰이 유효하다면 정보 업데이트
          user.value = {
            ...parsedUser,
            userId: tokenPayload.userId,
            shopId: tokenPayload.shopId,
            role: tokenPayload.role,
            tokenExpiry: tokenPayload.exp ? new Date(tokenPayload.exp * 1000) : null
          }
          
          accessToken.value = savedAccessToken
          refreshToken.value = savedRefreshToken
          isAuthenticated.value = true
        } else {
          // 토큰 디코딩 실패 시 로그아웃 처리
          logout()
        }
      }
    } catch (error) {
      console.error('인증 확인 실패:', error)
      // 오류 발생 시 로그아웃 처리
      logout()
    }
  }

  const validateToken = async () => {
    try {
      // 토큰 만료 여부를 클라이언트에서 먼저 확인
      if (isTokenExpired()) {
        try {
          await refreshAccessToken()
        } catch {
          logout()
        }
        return
      }
      
      // 필요한 경우에만 서버 검증 (현재는 클라이언트 검증만 사용)
      console.log('토큰이 유효합니다')
    } catch (error) {
      console.error('토큰 유효성 검사 실패:', error)
      logout()
    }
  }

  const getCurrentEmployee = () => {
    if (user.value && (user.value.role === 'employee' || user.value.role === 'admin')) {
      return user.value
    }
    return null
  }

  // 토큰에서 현재 사용자 정보 가져오기
  const getUserFromToken = () => {
    if (!accessToken.value) return null
    
    const tokenPayload = decodeJWT(accessToken.value)
    return tokenPayload
  }

  // 토큰 만료 여부 확인
  const isTokenExpired = () => {
    if (!accessToken.value) return true
    
    const tokenPayload = decodeJWT(accessToken.value)
    if (!tokenPayload || !tokenPayload.exp) return true
    
    const currentTime = Math.floor(Date.now() / 1000)
    return tokenPayload.exp < currentTime
  }

  // API 인스턴스를 외부에서 사용할 수 있도록 제공
  const getApiInstance = () => api

  return {
    // State
    user,
    isAuthenticated,
    loading,
    accessToken,
    refreshToken,
    
    // Actions
    login,
    logout,
    checkAuth,
    getCurrentEmployee,
    fetchCompleteUserData,
    refreshAccessToken,
    validateToken,
    getApiInstance,
    
    // JWT 관련 헬퍼 함수들
    decodeJWT,
    getUserFromToken,
    isTokenExpired
  }
})