<template>
  <div class="workshift-calendar">
    <!-- 선택된 근무 정보 표시 -->
    <div v-if="selectedShift" class="selected-shift-info">
      <div class="selected-shift-header">
        <div class="employee-header-info">
          <div 
            class="employee-avatar" 
            :style="{ 
              backgroundColor: selectedShift.employee?.personalColor || getDefaultPersonalColor(selectedShift.employee?.position) 
            }"
          >
            {{ selectedShift.employee?.name?.charAt(0) || '?' }}
          </div>
          <h4>{{ selectedShift.employee?.name }} 근무 정보</h4>
        </div>
        <button @click="selectedShift = null" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      <div class="selected-shift-details">
        <div class="detail-item">
          <span class="label">날짜:</span>
          <span class="value">{{ formatDate(selectedShift.startAt) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">근무시간:</span>
          <span class="value">{{ formatShiftTime(selectedShift.startAt, selectedShift.endAt) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">부서:</span>
          <span class="value">{{ formatSection(selectedShift.employee?.section) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">직급:</span>
          <span class="value">{{ formatPosition(selectedShift.employee?.position) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">비용:</span>
          <span class="value">{{ calculateShiftCost(selectedShift) }}</span>
        </div>
      </div>
    </div>

    <!-- 달력 헤더 -->
    <div class="calendar-header">
      <!-- 상단 컨트롤 영역 -->
      <div class="header-top">
        <div class="nav-controls">
          <button @click="previousMonth" class="nav-btn" :disabled="loading">
            <AppIcon name="chevron-left" :size="16" class="mr-1" />
          </button>
          <h3 class="current-month">{{ currentMonthLabel }}</h3>
          <button @click="nextMonth" class="nav-btn" :disabled="loading">
            <AppIcon name="chevron-right" :size="16" class="ml-1" />
          </button>
        </div>
        <div class="header-controls">
          <div class="employee-filter">
            <select
              v-model="selectedEmployeeId"
              @change="handleEmployeeFilter"
              class="employee-select-compact"
            >
              <option value="">전체 직원</option>
              <option
                v-for="employee in employees"
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.name }} ({{ formatSection(employee.section) }})
              </option>
            </select>
          </div>
          <div class="calendar-actions">
            <button @click="handleCreateNew" class="btn-compact btn-primary" title="새 근무 등록">
              <AppIcon name="plus" :size="14" />
            </button>
            <button @click="handleRefresh" class="btn-compact btn-secondary" :disabled="loading" title="새로고침">
              <AppIcon name="arrows-up-down" :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- 하단 뷰 선택 영역 제거됨 -->
    </div>

    <!-- 로딩 상태 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>근무 일정을 불러오는 중...</p>
    </div>

    <!-- 월간 뷰 -->
    <div v-else class="calendar-grid">
      <!-- 요일 헤더 -->
      <div class="weekdays">
        <div v-for="day in weekdays" :key="day" class="weekday">
          {{ day }}
        </div>
      </div>

      <!-- 날짜 그리드 -->
      <div class="dates-grid">
        <div
          v-for="date in calendarDates"
          :key="`${date.year}-${date.month}-${date.date}`"
          :class="[
            'date-cell',
            {
              'other-month': !date.isCurrentMonth,
              'today': date.isToday,
              'selected': date.isSelected,
              'has-shifts': getDateShifts(date).length > 0
            }
          ]"
          @click="handleDateClick(date)"
        >
          <!-- 날짜 헤더 (날짜 번호만) -->
          <div class="date-header">
            <div class="date-number">{{ date.date }}</div>
          </div>
          
          <!-- 해당 날짜의 근무 일정들 (스크롤 가능) -->
          <div v-if="date.isCurrentMonth" class="date-shifts-container">
            <div class="date-shifts">
              <div
                v-for="shift in getDateShifts(date).filter(s => getShiftStatus(s, date) !== 'CANCELED')"
                :key="shift.id"
                :class="[
                  'shift-indicator-simple',
                  `shift-${shift.employee?.section?.toLowerCase() || 'default'}`,
                  `position-${shift.employee?.position?.toLowerCase() || 'default'}`,
                  `status-${getShiftStatus(shift, date).toLowerCase()}`,
                  { 'selected': selectedShift?.id === shift.id }
                ]"
                :style="{
                  '--personal-color': shift.employee?.personalColor || getDefaultPersonalColor(shift.employee?.position),
                  '--status-color': getStatusColor(getShiftStatus(shift, date))
                }"
                @click.stop="handleShiftClick(shift)"
                :title="`${shift.employee?.name} - ${formatShiftTime(shift.startAt, shift.endAt)}`"
              >
                <span class="employee-name">{{ shift.employee?.name || '알수없음' }}</span>
                <span v-if="getShiftStatus(shift, date) === 'REVIEW'" class="status-icon">!</span>
              </div>
            </div>
          </div>
          
          <!-- 하루 총인원 및 알바비 표시 (하단에 배치) -->
          <div v-if="date.isCurrentMonth" class="daily-cost-boxes">
            <div v-if="getDailyCostDisplay(date).totalPeople.show" class="daily-cost-box total-people">
              {{ getDailyCostDisplay(date).totalPeople.text }}
            </div>
            <div v-if="getDailyCostDisplay(date).partTimeCost.show" class="daily-cost-box part-time-cost">
              {{ getDailyCostDisplay(date).partTimeCost.text }}
            </div>
          </div>

          <!-- 개별 + 버튼 제거됨 -->
        </div>
      </div>
    </div>

    <!-- 주간 뷰 제거됨 -->

    <!-- 플로팅 액션 버튼 -->
    <button
      @click="handleCreateNew"
      class="floating-action-btn"
      title="새 근무 등록"
    >
      <AppIcon name="plus" :size="20" class="fab-icon" />
    </button>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'WorkshiftCalendar',
  props: {
    workshifts: {
      type: Array,
      default: () => []
    },
    selectedDate: {
      type: Date,
      default: () => new Date()
    },
    loading: {
      type: Boolean,
      default: false
    },
    employees: {
      type: Array,
      default: () => []
    }
  },
  emits: ['date-select', 'shift-select', 'create-shift', 'employee-filter', 'refresh', 'create-new'],
  setup(props, { emit }) {
    const attendanceStore = useAttendanceStore()
    const currentDate = ref(new Date(props.selectedDate))
    const selectedShift = ref(null)
    const selectedEmployeeId = ref('')

    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    
    const currentMonthLabel = computed(() => {
      return currentDate.value.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long'
      })
    })
    
    // 달력 날짜 계산
    const calendarDates = computed(() => {
      const year = currentDate.value.getFullYear()
      const month = currentDate.value.getMonth()
      const today = new Date()
      const selected = new Date(props.selectedDate)
      
      // 해당 월의 첫째 날과 마지막 날
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      
      // 달력 시작 날짜 (이전 월의 날짜들 포함)
      const startDate = new Date(firstDay)
      startDate.setDate(startDate.getDate() - firstDay.getDay())
      
      // 달력 종료 날짜 (다음 월의 날짜들 포함)
      const endDate = new Date(lastDay)
      const remainingDays = 6 - lastDay.getDay()
      endDate.setDate(endDate.getDate() + remainingDays)
      
      const dates = []
      const current = new Date(startDate)
      
      while (current <= endDate) {
        const dateInfo = {
          year: current.getFullYear(),
          month: current.getMonth(),
          date: current.getDate(),
          fullDate: new Date(current),
          isCurrentMonth: current.getMonth() === month,
          isToday: 
            current.getFullYear() === today.getFullYear() &&
            current.getMonth() === today.getMonth() &&
            current.getDate() === today.getDate(),
          isSelected:
            current.getFullYear() === selected.getFullYear() &&
            current.getMonth() === selected.getMonth() &&
            current.getDate() === selected.getDate(),
          weekday: current.getDay()
        }
        dates.push(dateInfo)
        current.setDate(current.getDate() + 1)
      }
      
      return dates
    })
    
    const getDateShifts = (dateInfo) => {
      const targetDate = dateInfo.fullDate
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
      
      return props.workshifts.filter(shift => {
        const shiftStart = new Date(shift.startAt)
        const shiftEnd = new Date(shift.endAt)
        
        return (shiftStart >= startOfDay && shiftStart <= endOfDay) ||
               (shiftEnd >= startOfDay && shiftEnd <= endOfDay) ||
               (shiftStart < startOfDay && shiftEnd > endOfDay)
      })
    }
    
    const formatShiftTime = (startAt, endAt) => {
      if (!startAt || !endAt) return '-'
      const startTime = new Date(startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
      const endTime = new Date(endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
      return `${startTime} - ${endTime}`
    }
    
// 주간 뷰 함수들 제거됨
    
    const previousMonth = () => {
      currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
    }
    
    const nextMonth = () => {
      currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
    }
    
    const handleDateClick = (dateInfo) => {
      emit('date-select', dateInfo.fullDate)
    }
    
    const handleShiftClick = (shift) => {
      selectedShift.value = shift
      emit('shift-select', shift)
    }
    
    const handleCreateClick = (dateInfo) => {
      emit('create-shift', dateInfo.fullDate)
    }
    
// handleHourClick 제거됨

    const handleEmployeeFilter = () => {
      emit('employee-filter', selectedEmployeeId.value)
    }

    const handleRefresh = () => {
      emit('refresh')
    }

    const handleCreateNew = () => {
      emit('create-new')
    }
    

    
    // 개별 근무 비용 계산 (주간 뷰용)
    const calculateShiftCost = (shift) => {
      if (!shift?.employee) return ''
      
      const startTime = new Date(shift.startAt)
      const endTime = new Date(shift.endAt)
      const workMinutes = (endTime - startTime) / (1000 * 60)
      const workHours = workMinutes / 60
      
      const employee = shift.employee
      const position = employee.position
      const hourlyPay = employee.hourlyPay || employee.hourlyWage || employee.pay
      
      // 아르바이트인 경우에만 시급으로 계산
      if (position === 'PART_TIME' && hourlyPay && hourlyPay > 0 && workHours > 0) {
        const totalPay = workHours * hourlyPay
        return `${formatCurrency(Math.round(totalPay))}원`
      } else {
        return '정규직'
      }
    }
    
    // 하루 총 비용 계산 (개선된 버전 - 총인원 포함)
    const getDailyCost = (dateInfo) => {
      const shifts = getDateShifts(dateInfo)
      let totalCost = 0
      let regularStaffCount = 0
      let totalPeopleCount = 0
      
      if (!shifts || shifts.length === 0) {
        return { hourlyTotal: 0, regularCount: 0, totalCount: 0 }
      }
      
      // 중복된 직원 제거를 위한 Set
      const uniqueEmployees = new Set()
      
      shifts.forEach(shift => {
        if (!shift?.employee) return
        
        // 고유 직원 ID로 중복 제거
        const employeeId = shift.employee.id || shift.employee.name
        if (!uniqueEmployees.has(employeeId)) {
          uniqueEmployees.add(employeeId)
          totalPeopleCount++
          
          if (shift.employee.position !== 'PART_TIME') {
            regularStaffCount++
          }
        }
        
        const startTime = new Date(shift.startAt)
        const endTime = new Date(shift.endAt)
        const workMinutes = (endTime - startTime) / (1000 * 60)
        const workHours = workMinutes / 60
        
        const employee = shift.employee
        const position = employee.position
        const hourlyPay = employee.pay
        
        if (position === 'PART_TIME' && hourlyPay && hourlyPay > 0 && workHours > 0) {
          const cost = workHours * hourlyPay
          totalCost += cost
        }
      })
      
      return { hourlyTotal: Math.round(totalCost), regularCount: regularStaffCount, totalCount: totalPeopleCount }
    }
    
    // 하루 비용 표시 형식 결정 (분리된 박스 버전)
    const getDailyCostDisplay = (dateInfo) => {
      const shifts = getDateShifts(dateInfo)
      
      // 근무가 없으면 아예 표시하지 않음
      if (!shifts || shifts.length === 0) {
        return { 
          totalPeople: { text: '', show: false },
          partTimeCost: { text: '', show: false }
        }
      }
      
      const cost = getDailyCost(dateInfo)
      
      // 총인원 표시
      const totalPeopleDisplay = cost.totalCount > 0 ? {
        text: `총인원 ${cost.totalCount}`,
        show: true
      } : {
        text: '',
        show: false
      }
      
      // 당일 알바비 지출 표시
      const partTimeCostDisplay = cost.hourlyTotal > 0 ? {
        text: `${formatCurrency(cost.hourlyTotal)}원`,
        show: true
      } : {
        text: '',
        show: false
      }
      
      return {
        totalPeople: totalPeopleDisplay,
        partTimeCost: partTimeCostDisplay
      }
    }
    
    // 통화 포맷팅 (세 자리마다 콤마 추가)
    const formatCurrency = (amount) => {
      if (amount === 0) return ''
      return amount.toLocaleString('ko-KR')
    }
    
    // 날짜 포맷팅
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    }
    
    // 부서 포맷팅
    const formatSection = (section) => {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방'
      }
      return sections[section] || section || '미지정'
    }
    
    // 직급 포맷팅
    const formatPosition = (position) => {
      const positions = {
        'OWNER': '오너',
        'MANAGER': '매니저',
        'STAFF': '스태프',
        'PART_TIME': '아르바이트'
      }
      return positions[position] || position || '미지정'
    }
    
    // 근무 상태 결정 함수
    // SCHEDULED-예정, IN_PROGRESS-근무중, COMPLETED-근무완료, CANCELED-취소됨, MISSED-결근, REVIEW-리뷰필요함
    const getShiftStatus = (shift) => {
      if (!shift || !shift.employee) return 'SCHEDULED'
      
      // 먼저 shift 자체의 status를 확인 (백엔드에서 설정된 상태)
      if (shift.status) {
        switch (shift.status.toUpperCase()) {
          case 'SCHEDULED': return 'SCHEDULED'
          case 'IN_PROGRESS': return 'IN_PROGRESS'
          case 'COMPLETED': return 'COMPLETED'
          case 'CANCELED': return 'CANCELED'
          case 'CANCELLED': return 'CANCELED'
          case 'MISSED': return 'MISSED'
          case 'REVIEW': return 'REVIEW'
          default: return shift.status.toUpperCase()
        }
      }
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const shiftDate = new Date(shift.startAt)
      shiftDate.setHours(0, 0, 0, 0)
      
      const dateStr = shiftDate.toISOString().split('T')[0]
      const records = attendanceStore.getEmployeeRecordsByDate(dateStr, shift.employee.id)
      
      // 오늘인 경우
      if (shiftDate.getTime() === today.getTime()) {
        if (records.length > 0 && records[0].clockInAt && !records[0].clockOutAt) {
          return 'IN_PROGRESS'
        } else if (records.length > 0 && records[0].clockInAt && records[0].clockOutAt) {
          return 'COMPLETED'
        } else {
          return 'SCHEDULED'
        }
      } 
      // 과거 날짜인 경우
      else if (shiftDate < today) {
        if (records.length > 0 && (records[0].clockInAt || records[0].workedMinutes > 0)) {
          return 'COMPLETED'
        } else {
          return 'MISSED'
        }
      }
      // 미래 날짜인 경우
      else {
        return 'SCHEDULED'
      }
    }
    
    // personalColor 기본값 설정
    const getDefaultPersonalColor = (position) => {
      const positionColors = {
        'OWNER': '#8b5cf6',
        'MANAGER': '#06b6d4', 
        'STAFF': '#10b981',
        'PART_TIME': '#f59e0b'
      }
      return positionColors[position] || '#3b82f6'
    }
    
    // 상태별 색상 반환
    const getStatusColor = (status) => {
      const statusColors = {
        'SCHEDULED': '#3b82f6',     // info/blue
        'IN_PROGRESS': '#10b981',   // success/green  
        'COMPLETED': '#6b7280',     // gray + strike-through
        'CANCELED': '#6b7280',      // gray (hidden from UI)
        'MISSED': '#dc2626',        // danger/red + strike-through
        'REVIEW': '#dc2626'         // danger/red + !
      }
      return statusColors[status] || '#3b82f6'
    }
    
    // selectedDate prop이 변경되면 currentDate도 업데이트
    watch(() => props.selectedDate, (newDate) => {
      currentDate.value = new Date(newDate)
    })
    
    return {
      currentDate,
      selectedShift,
      selectedEmployeeId,
      weekdays,
      currentMonthLabel,
      calendarDates,
      getDateShifts,
      formatShiftTime,
      previousMonth,
      nextMonth,
      handleDateClick,
      handleShiftClick,
      handleCreateClick,
      handleEmployeeFilter,
      handleRefresh,
      handleCreateNew,
      calculateShiftCost,
      getDailyCost,
      getDailyCostDisplay,
      formatCurrency,
      formatDate,
      formatSection,
      formatPosition,
      getShiftStatus,
      getDefaultPersonalColor,
      getStatusColor
    }
  }
}
</script>
<style scoped src="@/assets/styles/components/AdminWorkshiftView/AdminWorkshiftCalendar.css"></style>
