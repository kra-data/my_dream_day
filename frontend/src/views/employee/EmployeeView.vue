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

      <!-- 오늘의 근무 일정 -->
      <TodayWorkshifts
        :attendance-store="attendanceStore"
        :attendance-loading="attendanceLoading"
        @attendance-updated="handleAttendanceUpdate"
        @qr-check-in-requested="handleQRCheckInRequest"
        @qr-check-out-requested="handleQRCheckOutRequest"
      />

      <!-- 이번 주 근무 현황 -->
      <WeekSummary />

      <!-- 내 근무 일정 -->
      <EmployeeWorkshiftView />

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
      @close="showMyPage = false"
    />

    <!-- QR 스캐너 모달 -->
    <QRScannerModal
      v-if="showQRScanner"
      @scan-result="handleQRScanCompleted"
      @close="closeQRScanner"
    />

    <!-- 출근 확인 모달 -->
    <CheckInConfirmationModal
      v-if="showCheckInConfirmation"
      :show="true"
      :preview-data="checkInPreviewData"
      :loading="attendanceLoading"
      @confirm="handleCheckInConfirm"
      @close="closeCheckInConfirmation"
    />

    <!-- 퇴근 확인 모달 -->
    <CheckOutConfirmationModal
      v-if="showCheckOutConfirmation"
      :show="true"
      :preview-data="checkOutPreviewData"
      :loading="attendanceLoading"
      @confirm="handleCheckOutConfirm"
      @close="closeCheckOutConfirmation"
    />

    <!-- 출퇴근 결과 모달 -->
    <AttendanceResultModal
      v-if="showAttendanceResult"
      :show="true"
      :type="attendanceResultType"
      :result-data="attendanceResultData"
      :error-message="attendanceErrorMessage"
      @close="closeAttendanceResult"
    />
  </div>
</template>

<script>
import { onMounted, computed, ref } from 'vue'
import EmployeeHeader from '@/components/EmployeeView/EmployeeHeader.vue'
import TodayWorkshifts from '@/components/EmployeeView/TodayWorkshifts.vue'
import WeekSummary from '@/components/EmployeeView/WeekSummary.vue'
import MonthlyCalendar from '@/components/EmployeeView/MonthlyCalendar.vue'
import QRModal from '@/components/EmployeeView/QRModal.vue'
import MyPageModal from '@/components/EmployeeView/MyPageModal.vue'
import QRScannerModal from '@/components/EmployeeView/QRScannerModal.vue'
import CheckInConfirmationModal from '@/components/EmployeeView/CheckInConfirmationModal.vue'
import CheckOutConfirmationModal from '@/components/EmployeeView/CheckOutConfirmationModal.vue'
import AttendanceResultModal from '@/components/EmployeeView/AttendanceResultModal.vue'
import EmployeeWorkshiftView from '@/components/EmployeeView/EmployeeWorkshiftView.vue'
import { useAuthStore } from '@/stores/auth'
import { useAttendanceStore } from '@/stores/attendance'
import { useWorkshiftStore } from '@/stores/workshift'

export default {
  name: 'EmployeeView',
  components: {
    EmployeeHeader,
    TodayWorkshifts,
    WeekSummary,
    MonthlyCalendar,
    QRModal,
    MyPageModal,
    QRScannerModal,
    CheckInConfirmationModal,
    CheckOutConfirmationModal,
    AttendanceResultModal,
    EmployeeWorkshiftView
  },
  setup() {
    const authStore = useAuthStore()
    const attendanceStore = useAttendanceStore()
    const workshiftStore = useWorkshiftStore()
    
    // 로딩 및 에러 상태 관리
    const isLoading = computed(() => attendanceStore.loading)
    const hasError = computed(() => !!attendanceStore.error)
    const errorMessage = computed(() => attendanceStore.error)
    const attendanceLoading = computed(() => attendanceStore.loading)
    
    // 캘린더 상태
    const now = new Date()
    const calendarYear = ref(now.getFullYear())
    const calendarMonth = ref(now.getMonth() + 1)
    
    // 데이터 초기화 - 직원용 데이터만 로드
    const initializeData = async () => {
      try {
        if (authStore.isAuthenticated) {
          // 직원용 데이터 초기화
          const today = new Date()
          await Promise.all([
            attendanceStore.initializeEmployeeData(),
            workshiftStore.fetchMyWorkshifts(
              today.getMonth() + 1, // month is 1-based
              today.getFullYear()
            )
          ])
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
      workshiftStore,
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
      scanResult: null,
      // QR 및 출퇴근 모달 상태
      showQRScanner: false,
      showCheckInConfirmation: false,
      showCheckOutConfirmation: false,
      checkInPreviewData: null,
      checkOutPreviewData: null,
      showAttendanceResult: false,
      attendanceResultType: 'success',
      attendanceResultData: null,
      attendanceErrorMessage: '',
      // QR 스캔 유형 ('IN' | 'OUT')
      qrScanType: null,
      // 현재 선택된 근무 시프트
      currentShift: null
    }
  },
  computed: {
    currentEmployee() {
      const user = this.authStore.user || {}
      // authStore의 user 객체가 empId를 가지고 있는지 확인하고, 없으면 id로 설정
      return {
        ...user,
        id: user.empId || user.id || user.userId,
        empId: user.empId || user.id || user.userId
      }
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
        // QR 코드를 통한 출퇴근은 오늘의 첫 번째 근무에 연결
        const todayShifts = this.attendanceStore.todayWorkshifts || []
        if (todayShifts.length === 0) {
          this.scanResult = {
            type: 'error',
            message: '오늘 예정된 근무가 없습니다. 먼저 근무 일정을 생성해주세요.'
          }
          return
        }

        const activeShift = todayShifts.find(shift => 
          shift.actualInAt && !shift.actualOutAt
        ) || todayShifts[0]

        const user = JSON.parse(localStorage.getItem('user'))
        const shopId = user ? user.shopId : null
        if (!shopId) {
          throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
        }

        if (this.qrAction === 'check-in') {
          await this.attendanceStore.checkIn(parseInt(shopId), activeShift.id)
          this.scanResult = {
            type: 'success',
            message: '출근이 완료되었습니다!'
          }
        } else {
          await this.attendanceStore.checkOut(parseInt(shopId), activeShift.id)
          this.scanResult = {
            type: 'success',
            message: '퇴근이 완료되었습니다!'
          }
        }

        setTimeout(() => {
          this.closeQRModal()
          this.handleAttendanceUpdate()
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
        minute: '2-digit',
        hour12: false
      })
    },

    formatCurrency(amount) {
      if (!amount) return '0원'
      return `${amount.toLocaleString('ko-KR')}원`
    },

    async handleAttendanceUpdate() {
      // 출퇴근 처리 후 오늘의 근무 일정 업데이트 (attendance는 이제 workshift 종속)
      try {
        await this.attendanceStore.fetchTodayWorkshifts()
      } catch (error) {
        console.error('근무 일정 업데이트 실패:', error)
      }
    },

    // QR 및 출퇴근 모달 관리 함수들
    handleQRCheckInRequest() {
      console.log('QR check-in requested')
      this.qrScanType = 'IN'
      this.showQRScanner = true
    },

    handleQRCheckOutRequest(shift = null) {
      console.log('QR check-out requested', shift)
      this.qrScanType = 'OUT'
      this.currentShift = shift
      this.showQRScanner = true
    },

    async handleQRScanCompleted(qrData) {
      console.log('QR scan completed:', qrData, 'type:', this.qrScanType)
      this.showQRScanner = false

      if (!qrData) {
        this.showAttendanceError('QR 코드를 입력해주세요')
        return
      }

      try {
        if (this.qrScanType === 'OUT') {
          // 퇴근 처리
          const previewData = await this.processQRDataForCheckout(qrData)
          this.checkOutPreviewData = previewData
          this.showCheckOutConfirmation = true
        } else {
          // 출근 처리 (기존 로직)
          const previewData = await this.processQRData(qrData)
          this.checkInPreviewData = previewData
          this.showCheckInConfirmation = true
        }
      } catch (error) {
        const errorType = this.qrScanType === 'OUT' ? '퇴근' : '출근'
        console.error(`${errorType} 미리보기 실패:`, error)
        this.showAttendanceError(error.message || `${errorType} 미리보기에 실패했습니다`)
      }
    },

    async processQRData(qrData) {
      // JWT 토큰 추출 및 디코딩
      const jwtToken = this.extractTokenFromURL(qrData)
      const payload = this.decodeJWT(jwtToken)
      const scannedAt = new Date().toISOString()

      // 출근 미리보기 API 호출
      const previewData = await this.attendanceStore.attendancePreview(
        payload.shopId,
        'IN',
        scannedAt
      )

      if (!previewData || typeof previewData !== 'object') {
        throw new Error('출근 미리보기 데이터가 올바르지 않습니다')
      }

      return {
        ...previewData,
        qrPayload: payload,
        scannedAt: scannedAt,
        suggestedAt: previewData.suggestedAt || scannedAt,
        message: previewData.message || '출근 시간을 확인해주세요'
      }
    },

    async processQRDataForCheckout(qrData) {
      // JWT 토큰 추출 및 디코딩
      const jwtToken = this.extractTokenFromURL(qrData)
      const payload = this.decodeJWT(jwtToken)
      const scannedAt = new Date().toISOString()

      // 퇴근할 시프트 ID 확인
      const shiftId = this.currentShift?.id || null

      if (!shiftId) {
        throw new Error('퇴근할 근무 일정을 찾을 수 없습니다')
      }

      // 퇴근 미리보기 API 호출 (shiftId 포함)
      const previewData = await this.attendanceStore.attendancePreview(
        payload.shopId,
        'OUT',
        scannedAt,
        shiftId
      )

      if (!previewData || typeof previewData !== 'object') {
        throw new Error('퇴근 미리보기 데이터가 올바르지 않습니다')
      }

      return {
        ...previewData,
        qrPayload: payload,
        scannedAt: scannedAt,
        suggestedAt: previewData.suggestedAt || scannedAt,
        message: previewData.message || '퇴근 시간을 확인해주세요',
        currentShift: this.currentShift
      }
    },

    extractTokenFromURL(qrData) {
      if (!qrData || typeof qrData !== 'string') {
        throw new Error('유효하지 않은 QR 코드 데이터입니다')
      }

      if (qrData.includes('token=')) {
        try {
          const url = new URL(qrData)
          const token = url.searchParams.get('token')
          if (!token) {
            throw new Error('URL에서 토큰을 찾을 수 없습니다')
          }
          return token.trim()
        } catch {
          throw new Error('URL 형식이 올바르지 않습니다')
        }
      }
      return qrData.trim()
    },

    decodeJWT(token) {
      try {
        if (!token || typeof token !== 'string') {
          throw new Error('유효하지 않은 토큰입니다')
        }

        const parts = token.split('.')
        if (parts.length !== 3) {
          throw new Error('유효하지 않은 JWT 형식입니다')
        }

        let payload = parts[1]
        payload = payload.replace(/-/g, '+').replace(/_/g, '/')
        while (payload.length % 4) {
          payload += '='
        }

        const decoded = atob(payload)
        const parsedPayload = JSON.parse(decoded)

        if (!parsedPayload.shopId || typeof parsedPayload.shopId !== 'number') {
          throw new Error('매장 ID가 없거나 유효하지 않습니다')
        }

        if (parsedPayload.purpose !== 'attendance') {
          throw new Error('출근용 QR 코드가 아닙니다')
        }

        return parsedPayload
      } catch (error) {
        throw new Error('QR 코드를 해석할 수 없습니다: ' + error.message)
      }
    },

    async handleCheckInConfirm(confirmedTime) {
      console.log('Check-in confirmed:', confirmedTime)
      this.showCheckInConfirmation = false

      try {
        if (!this.checkInPreviewData?.qrPayload) {
          throw new Error('QR 코드 정보가 없습니다')
        }

        const { qrPayload } = this.checkInPreviewData
        const finalTime = confirmedTime instanceof Date ? confirmedTime.toISOString() : confirmedTime

        const result = await this.attendanceStore.qrAttendance(
          qrPayload.shopId,
          'IN',
          finalTime
        )

        // 성공 결과 표시
        this.attendanceResultType = 'success'
        this.attendanceResultData = result
        this.showAttendanceResult = true

        // 근무 일정 새로고침
        await this.handleAttendanceUpdate()
      } catch (error) {
        console.error('출근 처리 실패:', error)
        this.showAttendanceError(error.message || '출근 처리에 실패했습니다')
      }
    },

    async handleCheckOutConfirm(confirmedTime) {
      console.log('Check-out confirmed:', confirmedTime)
      this.showCheckOutConfirmation = false

      try {
        if (!this.checkOutPreviewData?.qrPayload) {
          throw new Error('QR 코드 정보가 없습니다')
        }

        const { qrPayload, currentShift } = this.checkOutPreviewData
        const finalTime = confirmedTime instanceof Date ? confirmedTime.toISOString() : confirmedTime

        // 퇴근 API 호출 - shiftId와 함께 전송
        const payload = {
          shopId: qrPayload.shopId,
          type: 'OUT',
          at: finalTime
        }

        // currentShift가 있으면 shiftId 추가
        if (currentShift && currentShift.id) {
          payload.shiftId = currentShift.id
        }

        const result = await this.attendanceStore.qrAttendance(
          payload.shopId,
          payload.type,
          payload.at,
          payload.shiftId
        )

        // 성공 결과 표시
        this.attendanceResultType = 'success'
        this.attendanceResultData = result
        this.showAttendanceResult = true

        // 근무 일정 새로고침
        await this.handleAttendanceUpdate()
      } catch (error) {
        console.error('퇴근 처리 실패:', error)
        this.showAttendanceError(error.message || '퇴근 처리에 실패했습니다')
      }
    },

    showAttendanceError(message) {
      let userFriendlyMessage = message

      if (message.includes('JWT') || message.includes('해석할 수 없습니다') || message.includes('토큰')) {
        userFriendlyMessage = 'QR 코드가 유효하지 않습니다. 다시 스캔해주세요.'
      } else if (message.includes('shopId') || message.includes('매장')) {
        userFriendlyMessage = '매장 정보가 일치하지 않습니다. 올바른 QR 코드를 스캔해주세요.'
      } else if (message.includes('purpose') || message.includes('출근용')) {
        userFriendlyMessage = '이 QR 코드는 출근용이 아닙니다. 올바른 QR 코드를 스캔해주세요.'
      }

      this.attendanceResultType = 'error'
      this.attendanceErrorMessage = userFriendlyMessage
      this.showAttendanceResult = true
    },

    closeQRScanner() {
      this.showQRScanner = false
    },

    closeCheckInConfirmation() {
      this.showCheckInConfirmation = false
      this.checkInPreviewData = null
    },

    closeCheckOutConfirmation() {
      this.showCheckOutConfirmation = false
      this.checkOutPreviewData = null
      this.currentShift = null
    },

    closeAttendanceResult() {
      this.showAttendanceResult = false
      this.attendanceResultType = 'success'
      this.attendanceResultData = null
      this.attendanceErrorMessage = ''
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
@import '@/assets/styles/views/employee/EmployeeView.css';
</style>