<template>
  <div class="attendance-view">
    <div class="attendance-container">
      <!-- 페이지 헤더 -->
      <div class="page-header">
        <h1><AppIcon name="mobile" :size="24" class="mr-2" />출퇴근 체크</h1>
        <p class="current-time">{{ currentTime }}</p>
        <p class="current-date">{{ currentDate }}</p>
      </div>

      <!-- QR 스캔 섹션 -->
      <div class="scan-section">
        <div class="scan-card">
          <h2>QR 코드로 간편 출퇴근</h2>
          <p class="scan-instruction">
            직원 QR 코드를 카메라에 비춰주세요
          </p>
          
          <QRScanner @scan-result="handleQRScan" />
          
          <!-- 스캔 결과 표시 -->
          <div v-if="scanResult" class="scan-result">
            <div :class="['result-alert', scanResult.type]">
              <div class="result-icon">
                <AppIcon :name="scanResult.type === 'success' ? 'success' : 'error'" :size="20" />
              </div>
              <div class="result-content">
                <h3>{{ scanResult.title }}</h3>
                <p>{{ scanResult.message }}</p>
                <p class="result-time">{{ scanResult.time }}</p>
              </div>
            </div>
          </div>

          <!-- 최근 기록 -->
          <div v-if="recentRecords.length > 0" class="recent-records">
            <h3>최근 출퇴근 기록</h3>
            <div class="records-list">
              <div 
                v-for="record in recentRecords" 
                :key="record.id"
                class="record-item"
              >
                <div class="record-employee">
                  <div class="employee-avatar">
                    {{ getEmployeeName(record.employeeId).charAt(0) }}
                  </div>
                  <div class="employee-info">
                    <span class="employee-name">
                      {{ getEmployeeName(record.employeeId) }}
                    </span>
                    <span class="record-action">
                      {{ record.checkOut ? '퇴근' : '출근' }}
                    </span>
                  </div>
                </div>
                <div class="record-time">
                  {{ formatTime(record.checkOut || record.checkIn) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 수동 출퇴근 섹션 -->
      <div class="manual-section">
        <div class="manual-card">
          <h2>수동 출퇴근 처리</h2>
          <p>QR 코드가 없거나 카메라 사용이 어려울 때 사용하세요</p>
          
          <!-- 직원 선택 -->
          <div class="employee-selector">
            <label for="employee-select">직원 선택:</label>
            <select 
              id="employee-select" 
              v-model="selectedEmployeeId"
              class="employee-select"
            >
              <option value="">-- 직원을 선택하세요 --</option>
              <option 
                v-for="employee in employees" 
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.name }} ({{ employee.department }})
              </option>
            </select>
          </div>

          <!-- 선택된 직원 정보 -->
          <div v-if="selectedEmployee" class="selected-employee">
            <AttendanceCard 
              :employee="selectedEmployee"
              @attendance-updated="refreshData"
            />
          </div>
        </div>
      </div>

      <!-- 오늘의 통계 -->
      <div class="stats-section">
        <div class="stats-card">
          <h2>오늘의 출근 현황</h2>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-icon"><AppIcon name="users" :size="24" /></div>
              <div class="stat-info">
                <span class="stat-number">{{ todayStats.total }}</span>
                <span class="stat-label">전체 직원</span>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon"><AppIcon name="success" :size="24" /></div>
              <div class="stat-info">
                <span class="stat-number">{{ todayStats.checkedIn }}</span>
                <span class="stat-label">출근 완료</span>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon"><AppIcon name="clock" :size="24" /></div>
              <div class="stat-info">
                <span class="stat-number">{{ todayStats.working }}</span>
                <span class="stat-label">근무 중</span>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon"><AppIcon name="arrow-right" :size="24" /></div>
              <div class="stat-info">
                <span class="stat-number">{{ todayStats.checkedOut }}</span>
                <span class="stat-label">퇴근 완료</span>
              </div>
            </div>
          </div>

          <!-- 진행률 바 -->
          <div class="progress-section">
            <div class="progress-label">
              출근률: {{ Math.round((todayStats.checkedIn / todayStats.total) * 100) }}%
            </div>
            <div class="progress-bar">
              <div 
                class="progress-fill"
                :style="{ width: `${(todayStats.checkedIn / todayStats.total) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QRScanner from '@/components/QRScanner.vue'
import AttendanceCard from '@/components/AttendanceCard.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AttendanceView',
  components: {
    QRScanner,
    AttendanceCard,
    AppIcon
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
      currentTime: '',
      currentDate: '',
      timeInterval: null,
      scanResult: null,
      selectedEmployeeId: '',
      scanResultTimeout: null
    }
  },
  computed: {
    employees() {
      return this.employeesStore.employees
    },
    selectedEmployee() {
      if (!this.selectedEmployeeId) return null
      return this.employeesStore.getEmployeeById(this.selectedEmployeeId)
    },
    todayRecords() {
      return this.attendanceStore.getTodayRecords
    },
    recentRecords() {
      // 최근 5개 기록을 시간순으로 정렬
      return [...this.todayRecords]
        .sort((a, b) => {
          const timeA = new Date(b.checkOut || b.checkIn).getTime()
          const timeB = new Date(a.checkOut || a.checkIn).getTime()
          return timeA - timeB
        })
        .slice(0, 5)
    },
    todayStats() {
      const total = this.employees.length
      const checkedIn = this.todayRecords.filter(r => r.checkIn).length
      const checkedOut = this.todayRecords.filter(r => r.checkOut).length
      const working = checkedIn - checkedOut
      
      return { total, checkedIn, checkedOut, working }
    }
  },
  mounted() {
    this.updateTime()
    this.timeInterval = setInterval(this.updateTime, 1000)
  },
  beforeUnmount() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
    }
    if (this.scanResultTimeout) {
      clearTimeout(this.scanResultTimeout)
    }
  },
  methods: {
    updateTime() {
      const now = new Date()
      this.currentTime = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      this.currentDate = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    },

    async handleQRScan(qrData) {
      try {
        // 이전 결과 타임아웃 클리어
        if (this.scanResultTimeout) {
          clearTimeout(this.scanResultTimeout)
        }

        const result = await this.attendanceStore.processQRScan(qrData)
        const employee = this.employeesStore.getEmployeeById(result.employeeId)
        
        this.scanResult = {
          type: 'success',
          title: `${result.action === 'check-in' ? '출근' : '퇴근'} 완료`,
          message: `${employee.name}님이 ${result.action === 'check-in' ? '출근' : '퇴근'} 처리되었습니다.`,
          time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          employeeId: result.employeeId
        }

        // 5초 후 결과 자동 제거
        this.scanResultTimeout = setTimeout(() => {
          this.scanResult = null
        }, 5000)

      } catch (error) {
        console.error('QR 스캔 처리 실패:', error)
        
        this.scanResult = {
          type: 'error',
          title: '처리 실패',
          message: error.message || 'QR 코드 처리 중 오류가 발생했습니다.',
          time: new Date().toLocaleTimeString('ko-KR', { hour12: false })
        }

        // 3초 후 에러 메시지 제거
        this.scanResultTimeout = setTimeout(() => {
          this.scanResult = null
        }, 3000)
      }
    },

    refreshData() {
      // 데이터 새로고침
      this.$forceUpdate()
    },

    getEmployeeName(employeeId) {
      const employee = this.employeesStore.getEmployeeById(employeeId)
      return employee ? employee.name : '알 수 없음'
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/views/attendance.css';
</style>