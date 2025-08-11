<template>
  <div class="employee-view">
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
        <button @click="retryFetchData" class="btn btn-primary btn-base">다시 시도</button>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div v-else class="container">
      <!-- 직원 헤더 -->
      <EmployeeHeader 
        :user="currentEmployee"
        :current-date="currentDate"
        :current-time="currentTime"
        @show-my-page="showMyPage = true"
        @logout="logout"
      />

      <!-- 출퇴근 상태 -->
      <AttendanceStatus 
        :attendance-store="attendanceStore"
        :attendance-loading="attendanceLoading"
        @show-qr-modal="showQRModal"
      />

      <!-- 이번 주 근무 현황 -->
      <WeekSummary :week-summary="weekSummary" />

      <!-- 월간 캘린더 -->
      <MonthlyCalendar 
        :attendance-store="attendanceStore"
        :calendar-year="calendarYear"
        :calendar-month="calendarMonth"
        @change-month="changeMonth"
      />
    </div>

    <!-- QR 스캔 모달 -->
    <QRModal 
      :show="showQRScanModal"
      :action="qrAction"
      :loading="attendanceLoading"
      :scan-result="scanResult"
      @close="closeQRModal"
      @qr-scan="handleQRScan"
    />

    <!-- 마이페이지 모달 -->
    <MyPageModal 
      :show="showMyPage"
      :current-employee="currentEmployee"
      :monthly-stats="monthlyStats"
      @close="showMyPage = false"
    />
  </div>
</template>

<script>
import { onMounted, computed, ref } from 'vue'
import EmployeeHeader from '@/components/employee/EmployeeHeader.vue'
import AttendanceStatus from '@/components/employee/AttendanceStatus.vue'
import WeekSummary from '@/components/employee/WeekSummary.vue'
import MonthlyCalendar from '@/components/employee/MonthlyCalendar.vue'
import QRModal from '@/components/employee/QRModal.vue'
import MyPageModal from '@/components/employee/MyPageModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'EmployeeView',
  components: {
    EmployeeHeader,
    AttendanceStatus,
    WeekSummary,
    MonthlyCalendar,
    QRModal,
    MyPageModal
  },
  setup() {
    const authStore = useAuthStore()
    const attendanceStore = useAttendanceStore()
    
    // 로딩 및 에러 상태 관리
    const isLoading = computed(() => attendanceStore.loading)
    const hasError = computed(() => !!attendanceStore.error)
    const errorMessage = computed(() => attendanceStore.error)
    const attendanceLoading = computed(() => attendanceStore.loading)
    
    // 캘린더 상태
    const calendarYear = ref(new Date().getFullYear())
    const calendarMonth = ref(new Date().getMonth() + 1)
    
    // 데이터 초기화 - 직원용 데이터만 로드
    const initializeData = async () => {
      try {
        if (authStore.isAuthenticated) {
          // 직원용 데이터 초기화 (현재 상태 + 과거 기록)
          await attendanceStore.initializeEmployeeData()
        }
      } catch (error) {
        console.error('데이터 초기화 실패:', error)
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
      authStore,
      attendanceStore,
      isLoading,
      hasError,
      errorMessage,
      attendanceLoading,
      retryFetchData,
      calendarYear,
      calendarMonth
    }
  },
  data() {
    return {
      currentTime: '',
      currentDate: '',
      timeInterval: null,
      showQRScanModal: false,
      showMyPage: false,
      qrAction: null,
      scanResult: null
    }
  },
  computed: {
    currentEmployee() {
      return this.authStore.user || {}
    },
    weekSummary() {
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const today = new Date()
      const week = []
      
      const monday = new Date(today)
      monday.setDate(today.getDate() - today.getDay() + 1)
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        
        let status = 'future'
        let hours = null
        
        if (date.toDateString() === today.toDateString()) {
          status = 'today'
          if (this.attendanceStore.currentStatus.clockInAt) {
            const workedHours = Math.round(this.attendanceStore.currentStatus.workedMinutes / 60 * 10) / 10
            hours = workedHours + 'h'
          }
        } else if (date < today) {
          // 로컬 시간대 기준으로 날짜 문자열 생성 (시간대 차이 보정)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const dateStr = `${year}-${month}-${day}`
          const records = this.attendanceStore.getEmployeeRecordsByDate(dateStr)
          status = records.length > 0 ? 'worked' : 'absent'
          
          if (records.length > 0) {
            const record = records[0]
            // API에서 workedMinutes를 제공하면 우선 사용
            if (record.workedMinutes > 0) {
              hours = Math.round((record.workedMinutes / 60) * 10) / 10 + 'h'
            }
            // 그렇지 않으면 clockInAt, clockOutAt으로 계산
            else if (record.clockInAt && record.clockOutAt) {
              const workMs = new Date(record.clockOutAt) - new Date(record.clockInAt)
              hours = Math.round(workMs / (1000 * 60 * 60) * 10) / 10 + 'h'
            }
          }
        }
        
        // 로컬 시간대 기준으로 날짜 문자열 생성
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        week.push({
          date: dateStr,
          dayName: days[date.getDay()],
          dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
          status,
          hours
        })
      }
      
      return week
    },
    monthlyStats() {
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      
      const monthlyRecords = this.attendanceStore.employeeRecords.filter(record => {
        const recordDate = new Date(record.date || record.clockInAt)
        return recordDate.getMonth() === currentMonth &&
               recordDate.getFullYear() === currentYear
      })
      
      let totalHours = 0
      let workDays = 0
      let lateDays = 0
      let absentDays = 0
      let overtimeDays = 0
      
      if (this.attendanceStore.currentStatus.clockInAt) {
        workDays++
        totalHours += this.attendanceStore.currentStatus.workedMinutes / 60
        const checkInHour = new Date(this.attendanceStore.currentStatus.clockInAt).getHours()
        if (checkInHour > 9) {
          lateDays++
        }
        if (this.attendanceStore.currentStatus.workedMinutes > 480) {
          overtimeDays++
        }
      }
      
      monthlyRecords.forEach(record => {
        if (record.clockInAt) {
          const recordDate = new Date(record.date || record.clockInAt)
          if (recordDate.toDateString() === now.toDateString()) {
            return
          }
          
          workDays++
          const checkInHour = new Date(record.clockInAt).getHours()
          if (checkInHour > 9) {
            lateDays++
          }
          
          // API에서 workedMinutes를 제공하면 우선 사용
          if (record.workedMinutes > 0) {
            const workHours = record.workedMinutes / 60
            totalHours += workHours
            if (workHours > 8) {
              overtimeDays++
            }
          }
          // 그렇지 않으면 clockInAt, clockOutAt으로 계산
          else if (record.clockOutAt) {
            const workMs = new Date(record.clockOutAt) - new Date(record.clockInAt)
            const workHours = workMs / (1000 * 60 * 60)
            totalHours += workHours
            if (workHours > 8) {
              overtimeDays++
            }
          }
        }
      })
      
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      let weekdays = 0
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day)
        if (date.getDay() !== 0 && date.getDay() !== 6) {
          weekdays++
        }
      }
      absentDays = Math.max(0, weekdays - workDays)
      
      const hourlyRate = this.currentEmployee.payUnit === 'HOURLY' ? 
        this.currentEmployee.pay : 
        this.currentEmployee.pay / 160
      
      const baseSalary = totalHours * hourlyRate
      const overtimePay = overtimeDays * hourlyRate * 1.5
      const totalSalary = baseSalary + overtimePay
      
      return {
        totalHours: Math.round(totalHours * 10) / 10,
        workDays,
        lateDays,
        absentDays,
        overtimeDays,
        baseSalary,
        overtimePay,
        totalSalary
      }
    },
    calendarDays() {
      const days = []
      const today = new Date()
      const firstDay = new Date(this.calendarYear, this.calendarMonth - 1, 1)
      const lastDay = new Date(this.calendarYear, this.calendarMonth, 0)
      const firstDayOfWeek = firstDay.getDay()
      const daysInMonth = lastDay.getDate()
      
      // 이전 달의 마지막 며칠
      const prevMonthLastDay = new Date(this.calendarYear, this.calendarMonth - 1, 0)
      const prevMonthDays = prevMonthLastDay.getDate()
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        days.push({
          day: prevMonthDays - i,
          date: new Date(this.calendarYear, this.calendarMonth - 2, prevMonthDays - i).toISOString().split('T')[0],
          isCurrentMonth: false,
          worked: false,
          hours: null,
          isToday: false
        })
      }
      
      // 현재 달
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(this.calendarYear, this.calendarMonth - 1, day)
        const dateStr = date.toISOString().split('T')[0]
        const records = this.attendanceStore.getEmployeeRecordsByDate(dateStr)
        let hours = null
        let worked = false
        
        if (records.length > 0 && records[0].clockInAt && records[0].clockOutAt) {
          worked = true
          const workMs = new Date(records[0].clockOutAt) - new Date(records[0].clockInAt)
          hours = Math.round(workMs / (1000 * 60 * 60) * 10) / 10
        }
        
        days.push({
          day,
          date: dateStr,
          isCurrentMonth: true,
          worked,
          hours,
          isToday: date.toDateString() === today.toDateString()
        })
      }
      
      // 다음 달의 처음 며칠
      const lastDayOfWeek = lastDay.getDay()
      if (lastDayOfWeek < 6) {
        for (let day = 1; day <= 6 - lastDayOfWeek; day++) {
          days.push({
            day,
            date: new Date(this.calendarYear, this.calendarMonth, day).toISOString().split('T')[0],
            isCurrentMonth: false,
            worked: false,
            hours: null,
            isToday: false
          })
        }
      }
      
      return days
    },
    calendarStats() {
      const records = this.attendanceStore.employeeRecords.filter(record => {
        const recordDate = new Date(record.date || record.clockInAt)
        return recordDate.getFullYear() === this.calendarYear &&
               recordDate.getMonth() === this.calendarMonth - 1
      })
      
      let workDays = 0
      let totalHours = 0
      
      records.forEach(record => {
        if (record.clockInAt && record.clockOutAt) {
          workDays++
          const workMs = new Date(record.clockOutAt) - new Date(record.clockInAt)
          totalHours += workMs / (1000 * 60 * 60)
        }
      })
      
      return {
        workDays,
        totalHours: Math.round(totalHours * 10) / 10
      }
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
  },
  methods: {
    updateTime() {
      const now = new Date()
      this.currentTime = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      this.currentDate = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    },

    showQRModal(action) {
      this.qrAction = action
      this.showQRScanModal = true
      this.scanResult = null
      this.manualQRCode = '2'
    },

    closeQRModal() {
      this.showQRScanModal = false
      this.qrAction = null
      this.scanResult = null
      this.manualQRCode = '2'
    },

    async handleQRScan(qrData) {
      if (!qrData) {
        this.scanResult = {
          type: 'error',
          message: 'QR 코드를 입력해주세요'
        }
        return
      }

      try {
        const user = JSON.parse(localStorage.getItem('user'))
        const shopId = user ? user.shopId : null
        if (!shopId) {
          throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
        }

        if (this.qrAction === 'check-in') {
          await this.attendanceStore.checkIn(parseInt(shopId))
          this.scanResult = {
            type: 'success',
            message: '출근이 완료되었습니다!'
          }
        } else {
          await this.attendanceStore.checkOut(parseInt(shopId))
          this.scanResult = {
            type: 'success',
            message: '퇴근이 완료되었습니다!'
          }
        }

        setTimeout(() => {
          this.closeQRModal()
        }, 3000)

      } catch (error) {
        this.scanResult = {
          type: 'error',
          message: error.message || '출퇴근 처리에 실패했습니다'
        }
      }
    },

    formatSection(section) {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방'
      }
      return sections[section] || section
    },

    formatPosition(position) {
      const positions = {
        'OWNER': '오너',
        'MANAGER': '매니저',
        'STAFF': '스태프',
        'PART_TIME': '아르바이트'
      }
      return positions[position] || position
    },

    formatPay(pay, payUnit) {
      return `${pay.toLocaleString()}원 (${payUnit === 'HOURLY' ? '시급' : '월급'})`
    },

    formatPhone(phone) {
      if (!phone) return '-'
      return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    formatCurrency(amount) {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount)
    },

    async logout() {
      if (confirm('로그아웃 하시겠습니까?')) {
        try {
          await this.authStore.logout()
          this.$router.push('/login')
        } catch (error) {
          console.error('로그아웃 실패:', error)
          this.$router.push('/login')
        }
      }
    },

    changeMonth(delta) {
      let newMonth = this.calendarMonth + delta
      let newYear = this.calendarYear
      
      if (newMonth > 12) {
        newMonth = 1
        newYear++
      } else if (newMonth < 1) {
        newMonth = 12
        newYear--
      }
      
      this.calendarMonth = newMonth
      this.calendarYear = newYear
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/views/employee.css';
</style>