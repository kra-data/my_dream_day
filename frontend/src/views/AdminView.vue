<template>
  <div class="admin-view">
    <div class="admin-container">
      <!-- 관리자 헤더 -->
      <div class="admin-header">
        <h1>🛠️ 관리자 대시보드</h1>
        <p>직원 출퇴근 현황을 관리하고 통계를 확인하세요</p>
      </div>

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
        <!-- 탭 네비게이션 -->
        <div class="tab-navigation">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.icon }} {{ tab.name }}
          </button>
        </div>

        <!-- 동적 컴포넌트 렌더링 -->
        <component 
          :is="currentTabComponent" 
          @retry-fetch="retryFetchData"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, computed, ref } from 'vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'
import { useSalaryStore } from '@/stores/salary'
import { useAuthStore } from '@/stores/auth'

// 탭 컴포넌트들 import
import AdminDashboardView from '@/components/admin/AdminDashboardView.vue'
import AdminEmployeeView from '@/components/admin/AdminEmployeeView.vue'
import AdminSalaryView from '@/components/admin/AdminSalaryView.vue'
import AdminRecordsView from '@/components/admin/AdminRecordsView.vue'
import AdminAnalyticsView from '@/components/admin/AdminAnalyticsView.vue'

export default {
  name: 'AdminView',
  components: {
    AdminDashboardView,
    AdminEmployeeView,
    AdminSalaryView,
    AdminRecordsView,
    AdminAnalyticsView
  },
  setup() {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    const salaryStore = useSalaryStore()
    const authStore = useAuthStore()
    
    // 로딩 및 에러 상태 관리
    const isLoading = computed(() => 
      employeesStore.loading || attendanceStore.loading || salaryStore.loading
    )
    const hasError = computed(() => 
      !!employeesStore.error || !!attendanceStore.error || !!salaryStore.error
    )
    const errorMessage = computed(() => 
      employeesStore.error || attendanceStore.error || salaryStore.error
    )
    
    // 데이터 초기화
    const initializeData = async () => {
      try {
        if (authStore.isAuthenticated && authStore.user?.role === 'admin') {
          // 직원 목록 조회
          await employeesStore.fetchEmployees()
          
          // 대시보드 데이터 조회
          await attendanceStore.fetchDashboardData()
          
          // 출퇴근 기록 조회
          // await attendanceStore.fetchRecords()
          
          // 급여 데이터 조회
          const currentDate = new Date()
          await Promise.all([
            salaryStore.fetchPayrollDashboard(currentDate.getFullYear(), currentDate.getMonth() + 1),
            salaryStore.fetchEmployeePayrolls(currentDate.getFullYear(), currentDate.getMonth() + 1)
          ])
        }
      } catch (error) {
        console.error('데이터 초기화 실패:', error)
        attendanceStore.error = error.message || '데이터를 불러오는데 실패했습니다'
      }
    }
    
    // 데이터 재시도
    const retryFetchData = async () => {
      await initializeData()
    }
    
    // 컴포넌트 마운트 시 데이터 초기화
    onMounted(() => {
      initializeData()
    })
    
    return {
      employeesStore,
      attendanceStore,
      salaryStore,
      authStore,
      isLoading,
      hasError,
      errorMessage,
      retryFetchData,
      initializeData
    }
  },
  data() {
    return {
      activeTab: 'dashboard',
      tabs: [
        { id: 'dashboard', name: '대시보드', icon: '📊', component: 'AdminDashboardView' },
        { id: 'employees', name: '직원 관리', icon: '👥', component: 'AdminEmployeeView' },
        { id: 'payroll', name: '급여 관리', icon: '💰', component: 'AdminSalaryView' },
        { id: 'records', name: '출퇴근 기록', icon: '📋', component: 'AdminRecordsView' },
        { id: 'analytics', name: '통계', icon: '📈', component: 'AdminAnalyticsView' }
      ]
    }
  },
  computed: {
    currentTabComponent() {
      const tab = this.tabs.find(t => t.id === this.activeTab)
      return tab ? tab.component : 'AdminDashboardView'
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/views/admin.css';
</style>