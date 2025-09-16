<template>
  <div class="admin-view">
    <div class="admin-container">
      <!-- 관리자 헤더 -->
      <!-- <div class="admin-header">
      </div> -->

      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>데이터를 불러오는 중...</p>
      </div>

      <!-- 에러 상태 -->
      <div v-else-if="hasError" class="error-container">
        <div class="error-message">
          <h3>⚠️ 오류가 발생했습니다</h3>
          <p>{{ errorMessage }}</p>
          <button @click="retryFetchData" class="btn btn-primary">다시 시도</button>
        </div>
      </div>

      <!-- 메인 콘텐츠 -->
      <div v-else>
        <!-- Review Alert -->
        <ReviewAlert />
        
        <!-- 탭 네비게이션 -->
        <div class="tab-navigation">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="handleTabClick(tab.id)"
          >
            <AppIcon :name="tab.icon" :size="20" class="tab-icon" />
            <span>{{ tab.name }}</span>
          </button>
        </div>

        <!-- 동적 컴포넌트 렌더링 -->
        <component
          :is="currentTabComponent"
          @retry-fetch="retryFetchData"
        />
      </div>

      <!-- 모바일 하단 네비게이션 -->
      <nav class="mobile-bottom-nav">
        <button
          v-for="tab in tabs"
          :key="`mobile-${tab.id}`"
          :class="['mobile-nav-item', { active: activeTab === tab.id }]"
          @click="handleTabClick(tab.id)"
          :aria-label="`${tab.name} 탭으로 이동`"
        >
          <AppIcon :name="tab.icon" :size="20" class="mobile-nav-icon" />
          <span class="mobile-nav-label">{{ tab.name }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script>
import { onMounted, computed } from 'vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'
import { usePayrollStore } from '@/stores/payroll'
import { useAuthStore } from '@/stores/auth'
import { useWorkshiftStore } from '@/stores/workshift'

// 탭 컴포넌트들 import
import AdminWorkshiftView from '@/components/admin/AdminWorkshiftView.vue'
import AdminDashboardView from '@/components/admin/AdminDashboardView.vue'
import AdminEmployeeView from '@/components/admin/AdminEmployeeView.vue'
import AdminSalaryView from '@/components/admin/AdminSalaryView.vue'
import AdminRecordsView from '@/components/admin/AdminRecordsView.vue'
import AdminAnalyticsView from '@/components/admin/AdminAnalyticsView.vue'
import ReviewAlert from '@/components/admin/ReviewAlert.vue'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'AdminView',
  components: {
    AdminWorkshiftView,
    AdminDashboardView,
    AdminEmployeeView,
    AdminSalaryView,
    AdminRecordsView,
    AdminAnalyticsView,
    ReviewAlert,
    AppIcon
  },
  setup() {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    const payrollStore = usePayrollStore()
    const authStore = useAuthStore()
    const workshiftStore = useWorkshiftStore()
    
    // 로딩 및 에러 상태 관리
    const isLoading = computed(() => 
      employeesStore.loading || attendanceStore.loading || payrollStore.loading || workshiftStore.loading
    )
    const hasError = computed(() => 
      !!employeesStore.error || !!attendanceStore.error || !!payrollStore.error || !!workshiftStore.error
    )
    const errorMessage = computed(() => 
      employeesStore.error || attendanceStore.error || payrollStore.error || workshiftStore.error
    )
    
    // 데이터 초기화
    // 기본 데이터 초기화 (공통 데이터만)
    const initializeData = async () => {
      try {
        if (authStore.isAuthenticated && authStore.user?.role === 'admin') {
          // 직원 목록 조회 (모든 탭에서 사용)
          await employeesStore.fetchEmployees()
          
          // 기본 대시보드 데이터만 로드
          await attendanceStore.fetchDashboardData()
          
          // 검토 필요한 근무 일정 로드
          await workshiftStore.fetchReviewWorkshifts(authStore.user.shopId)
        }
      } catch (error) {
        console.error('기본 데이터 초기화 실패:', error)
        attendanceStore.error = error.message || '데이터를 불러오는데 실패했습니다'
      }
    }
    
    // 탭별 데이터 로딩 (지연 로딩)
    const loadTabData = async (tabId) => {
      try {
        console.log(`Loading data for tab: ${tabId}`)
        
        switch (tabId) {
          case 'workshift':
            // 근무 일정 캘린더 데이터 로드 (전체 직원)
            await workshiftStore.fetchCalendarWorkshifts(authStore.user?.shopId, null)
            break
            
          case 'dashboard':
            // 대시보드 데이터는 이미 로드됨
            break
            
          case 'records':
            // 출근 기록 데이터만 로드
            await attendanceStore.fetchRecords()
            break
            
          case 'payroll': {
            // 급여 데이터 로드 (rate limit 방지를 위한 순차 실행)
            const currentDate = new Date()
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth() + 1
            
            console.log(`🔄 AdminView: 급여 데이터 로딩 시작 (${year}년 ${month}월)`)
            
            await payrollStore.fetchEmployeePayrollList(year, month)
            break
          }
            
          case 'analytics':
            // 통계 데이터 로드 (필요시)
            break
            
          default:
            // 다른 탭에 대해서는 추가 처리 없음
            break
        }
      } catch (error) {
        console.error(`Tab ${tabId} data loading failed:`, error)
      }
    }
    
    const retryFetchData = async () => {
      await initializeData()
    }

    onMounted(() => {
      initializeData()
    })
    
    return {
      employeesStore,
      attendanceStore,
      payrollStore,
      authStore,
      workshiftStore,
      isLoading,
      hasError,
      errorMessage,
      retryFetchData,
      initializeData,
      loadTabData
    }
  },
  data() {
    return {
      activeTab: 'dashboard',
      loadedTabs: new Set(['dashboard']), // 이미 로드된 탭 추적
      tabs: [
        { id: 'workshift', name: '근무 일정', icon: 'calendar', component: 'AdminWorkshiftView' },
        { id: 'dashboard', name: '대시보드', icon: 'dashboard', component: 'AdminDashboardView' },
        { id: 'employees', name: '직원 관리', icon: 'users', component: 'AdminEmployeeView' },
        { id: 'payroll', name: '급여 관리', icon: 'money', component: 'AdminSalaryView' },
        { id: 'records', name: '출퇴근 기록', icon: 'clipboard', component: 'AdminRecordsView' },
        // { id: 'analytics', name: '통계', icon: 'analytics', component: 'AdminAnalyticsView' }
      ]
    }
  },
  computed: {
    currentTabComponent() {
      const tab = this.tabs.find(t => t.id === this.activeTab)
      return tab ? tab.component : 'AdminDashboardView'
    }
  },
  methods: {
    async handleTabClick(tabId) {
      console.log(`🔍 Tab clicked: ${tabId}`)
      
      // 탭 변경
      this.activeTab = tabId
      
      // 해당 탭의 데이터가 아직 로드되지 않았으면 로드
      if (!this.loadedTabs.has(tabId)) {
        console.log(`⬇️ Loading data for new tab: ${tabId}`)
        await this.loadTabData(tabId)
        this.loadedTabs.add(tabId)
        
        // payroll 탭 로드 후 상태 확인
        if (tabId === 'payroll') {
          console.log('🔍 급여관리 탭 로드 후 상태:', {
            dashboard: this.payrollStore.payrollDashboard,
            employees: this.payrollStore.employeePayrolls,
            loading: this.payrollStore.loading,
            error: this.payrollStore.error
          })
        }
      } else {
        console.log(`💾 Tab ${tabId} data already loaded, skipping`)
      }
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/views/admin.css';
</style>