<template>
  <div class="home-view">
    <div class="home-header">
      <h1>📱 출퇴근 관리 시스템</h1>
      <p>QR 코드를 스캔하거나 직접 출퇴근 처리하세요</p>
    </div>

    <div class="main-content">
      <!-- QR 스캐너 -->
      <div class="scanner-section">
        <h2>QR 코드 스캔</h2>
        <QRScanner @scan-result="handleQRScan" />
        
        <div v-if="scanResult" class="scan-result">
          <div class="result-card">
            <h3>{{ scanResult.action === 'check-in' ? '출근' : '퇴근' }} 완료!</h3>
            <p>{{ getEmployeeName(scanResult.employeeId) }}</p>
            <p>{{ new Date().toLocaleTimeString('ko-KR') }}</p>
          </div>
        </div>
      </div>

      <!-- 수동 출퇴근 -->
      <div class="manual-section">
        <h2>직접 출퇴근 처리</h2>
        <div class="employee-grid">
          <AttendanceCard 
            v-for="employee in employees" 
            :key="employee.id"
            :employee="employee"
            @attendance-updated="refreshData"
          />
        </div>
      </div>
    </div>

    <!-- 오늘의 현황 -->
    <div class="today-summary">
      <h2>오늘의 출근 현황</h2>
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-number">{{ todayStats.total }}</span>
          <span class="stat-label">전체 직원</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ todayStats.checkedIn }}</span>
          <span class="stat-label">출근 완료</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ todayStats.checkedOut }}</span>
          <span class="stat-label">퇴근 완료</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QRScanner from '@/components/QRScanner.vue'
import AttendanceCard from '@/components/AttendanceCard.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'HomeView',
  components: {
    QRScanner,
    AttendanceCard
  },
  setup() {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    
    return {
      employeesStore,
      attendanceStore
    }
  },
  data() {
    return {
      scanResult: null
    }
  },
  computed: {
    employees() {
      return this.employeesStore.employees
    },
    todayRecords() {
      return this.attendanceStore.getTodayRecords
    },
    todayStats() {
      const total = this.employees.length
      const checkedIn = this.todayRecords.filter(r => r.checkIn).length
      const checkedOut = this.todayRecords.filter(r => r.checkOut).length
      
      return { total, checkedIn, checkedOut }
    }
  },
  methods: {
    async handleQRScan(qrData) {
      try {
        const result = await this.attendanceStore.processQRScan(qrData)
        this.scanResult = result
        
        // 3초 후 결과 초기화
        setTimeout(() => {
          this.scanResult = null
        }, 3000)
      } catch (error) {
        alert('QR 처리 실패: ' + error.message)
      }
    },
    
    getEmployeeName(employeeId) {
      const employee = this.employeesStore.getEmployeeById(employeeId)
      return employee ? employee.name : '알 수 없음'
    },
    
    refreshData() {
      // 필요시 데이터 새로고침
      this.$forceUpdate()
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/views/home.css';
</style>