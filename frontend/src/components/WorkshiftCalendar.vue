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
      <div class="nav-controls">
        <button @click="previousMonth" class="nav-btn" :disabled="loading">
          <AppIcon name="chevron-left" :size="16" class="mr-1" />
          이전
        </button>
        <h3 class="current-month">{{ currentMonthLabel }}</h3>
        <button @click="nextMonth" class="nav-btn" :disabled="loading">
          다음
          <AppIcon name="chevron-right" :size="16" class="ml-1" />
        </button>
      </div>
      <div class="view-controls">
        <button 
          @click="currentView = 'month'" 
          :class="['view-btn', { active: currentView === 'month' }]"
        >
          월간
        </button>
        <button 
          @click="currentView = 'week'" 
          :class="['view-btn', { active: currentView === 'week' }]"
        >
          주간
        </button>
      </div>
    </div>

    <!-- 로딩 상태 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>근무 일정을 불러오는 중...</p>
    </div>

    <!-- 월간 뷰 -->
    <div v-else-if="currentView === 'month'" class="calendar-grid">
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
          <!-- 날짜 헤더 (날짜 번호 + 비용) -->
          <div class="date-header">
            <div class="date-number">{{ date.date }}</div>
            <!-- 하루 총인원 및 알바비 표시 (날짜 우측 상단에 분리된 박스들) -->
            <div v-if="date.isCurrentMonth" class="daily-cost-boxes">
              <div v-if="getDailyCostDisplay(date).totalPeople.show" class="daily-cost-box total-people">
                {{ getDailyCostDisplay(date).totalPeople.text }}
              </div>
              <div v-if="getDailyCostDisplay(date).partTimeCost.show" class="daily-cost-box part-time-cost">
                {{ getDailyCostDisplay(date).partTimeCost.text }}
              </div>
            </div>
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
          
          <!-- 새 일정 추가 버튼 -->
          <button
            v-if="date.isCurrentMonth && !loading"
            @click.stop="handleCreateClick(date)"
            class="add-shift-btn"
            title="새 일정 추가"
          >
            <AppIcon name="plus" :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- 주간 뷰 -->
    <div v-else class="week-view">
      <div class="week-header">
        <div class="time-column"></div>
        <div 
          v-for="date in weekDates" 
          :key="`week-${date.year}-${date.month}-${date.date}`"
          :class="['week-day-header', { today: date.isToday }]"
          @click="handleDateClick(date)"
        >
          <div class="day-name">{{ getWeekdayName(date.weekday) }}</div>
          <div class="day-date">{{ date.date }}</div>
          <div v-if="getDateShifts(date).length > 0" class="day-count">
            {{ getDateShifts(date).length }}개
          </div>
        </div>
      </div>
      
      <div class="week-grid">
        <!-- 시간 라벨 -->
        <div class="time-column">
          <div
            v-for="hour in 24"
            :key="hour"
            class="time-slot"
          >
            {{ String(hour - 1).padStart(2, '0') }}:00
          </div>
        </div>
        
        <!-- 각 요일별 컬럼 -->
        <div
          v-for="date in weekDates"
          :key="`week-col-${date.year}-${date.month}-${date.date}`"
          class="week-day-column"
        >
          <!-- 시간 슬롯들 -->
          <div
            v-for="hour in 24"
            :key="`${date.year}-${date.month}-${date.date}-${hour}`"
            class="hour-slot"
            @click="handleHourClick(date, hour - 1)"
          >
          </div>
          
          <!-- 해당 날짜의 근무 일정들을 시간대별로 배치 -->
          <div
            v-for="shift in getDateShifts(date).filter(s => getShiftStatus(s, date) !== 'CANCELED')"
            :key="`week-shift-${shift.id}`"
            :class="[
              'week-shift',
              `shift-${shift.employee?.section?.toLowerCase() || 'default'}`,
              `position-${shift.employee?.position?.toLowerCase() || 'default'}`,
              `status-${getShiftStatus(shift, date).toLowerCase()}`
            ]"
            :style="{
              ...getShiftStyle(shift),
              '--personal-color': shift.employee?.personalColor || getDefaultPersonalColor(shift.employee?.position),
              '--status-color': getStatusColor(getShiftStatus(shift, date))
            }"
            @click="handleShiftClick(shift)"
            :title="`${shift.employee?.name} - ${formatShiftTime(shift.startAt, shift.endAt)}`"
          >
            <div class="shift-content">
              <div class="shift-employee">
                {{ shift.employee?.name }}
                <span v-if="getShiftStatus(shift, date) === 'REVIEW'" class="status-icon">!</span>
              </div>
              <div class="shift-time">{{ formatShiftTime(shift.startAt, shift.endAt) }}</div>
              <div class="shift-cost">{{ calculateShiftCost(shift) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
    }
  },
  emits: ['date-select', 'shift-select', 'create-shift'],
  setup(props, { emit }) {
    const attendanceStore = useAttendanceStore()
    const currentView = ref('month')
    const currentDate = ref(new Date(props.selectedDate))
    const selectedShift = ref(null)
    
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
    
    // 주간 뷰용 날짜들
    const weekDates = computed(() => {
      const selected = new Date(props.selectedDate)
      const startOfWeek = new Date(selected)
      startOfWeek.setDate(selected.getDate() - selected.getDay())
      
      const dates = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek)
        date.setDate(startOfWeek.getDate() + i)
        
        const today = new Date()
        dates.push({
          year: date.getFullYear(),
          month: date.getMonth(),
          date: date.getDate(),
          fullDate: new Date(date),
          weekday: date.getDay(),
          isToday: 
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        })
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
    
    const getWeekdayName = (weekday) => {
      return weekdays[weekday]
    }
    
    const getShiftStyle = (shift) => {
      const start = new Date(shift.startAt)
      const end = new Date(shift.endAt)
      
      const startHour = start.getHours()
      const startMinute = start.getMinutes()
      const endHour = end.getHours()
      const endMinute = end.getMinutes()
      
      const startPosition = (startHour + startMinute / 60) * 60 // 60px per hour
      const duration = ((endHour + endMinute / 60) - (startHour + startMinute / 60)) * 60
      
      return {
        top: `${startPosition}px`,
        height: `${Math.max(duration, 20)}px`,
        left: '2px',
        right: '2px',
        position: 'absolute',
        zIndex: 1
      }
    }
    
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
    
    const handleHourClick = (dateInfo, hour) => {
      const dateTime = new Date(dateInfo.fullDate)
      dateTime.setHours(hour)
      emit('create-shift', dateTime)
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
      currentView,
      currentDate,
      selectedShift,
      weekdays,
      currentMonthLabel,
      calendarDates,
      weekDates,
      getDateShifts,
      formatShiftTime,
      getWeekdayName,
      getShiftStyle,
      previousMonth,
      nextMonth,
      handleDateClick,
      handleShiftClick,
      handleCreateClick,
      handleHourClick,
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

<style scoped>
.workshift-calendar {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px;
}

/* 선택된 근무 정보 표시 */
.selected-shift-info {
  background: linear-gradient(135deg, #e0e7ff 0%, #f3f4f6 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  color: #374151;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.selected-shift-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.employee-header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 2px solid white;
}

.selected-shift-header h4 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.selected-shift-header .close-btn {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #6366f1;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.selected-shift-header .close-btn:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
}

.selected-shift-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(10px);
}

.detail-item .label {
  font-weight: 500;
  color: #6b7280;
}

.detail-item .value {
  font-weight: 600;
  text-align: right;
  color: #374151;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-btn {
  padding: 8px 16px;
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.current-month {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  min-width: 140px;
  text-align: center;
}

.view-controls {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 8px;
}

.view-btn {
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.view-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}


@keyframes pulse {
  from { opacity: 1; }
  to { opacity: 0.7; }
}

/* 월간 뷰 스타일 */
.calendar-grid {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.weekday {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  color: #6b7280;
  font-size: 0.9rem;
}

.dates-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.date-cell {
  min-height: 140px;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.date-cell:hover {
  background: #f8fafc;
}

.date-cell.other-month {
  color: #d1d5db;
  background: #fafafa;
}

.date-cell.today {
  background: #dbeafe;
}

.date-cell.selected {
  background: #e0e7ff;
  color: #4338ca;
  border: 2px solid #6366f1;
}

.date-cell.has-shifts {
  background: #f8fafc;
  border: 2px solid #e2e8f0;
}

.date-cell.selected.has-shifts {
  background: #e0e7ff;
  border-color: #6366f1;
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  min-height: 18px;
  gap: 4px;
}

.date-number {
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1;
}

/* 상단 우측 비용 표시 박스들 (새 분리된 스타일) */
.daily-cost-boxes {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
  flex-shrink: 0;
}

.daily-cost-box {
  font-size: 0.6rem;
  font-weight: 700;
  border-radius: 5px;
  padding: 2px 5px;
  line-height: 1.3;
  white-space: nowrap;
  max-width: 80px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.daily-cost-box.total-people {
  color: #1f2937;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.daily-cost-box.part-time-cost {
  color: #dc2626;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #fecaca;
}

.date-shifts-container {
  flex: 1;
  margin: 8px 0 4px 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 70px;
  min-height: 30px;
  scrollbar-width: thin;
  scrollbar-color: rgba(203, 213, 224, 0.7) transparent;
  border-radius: 6px;
}

.date-shifts-container::-webkit-scrollbar {
  width: 6px;
}

.date-shifts-container::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.date-shifts-container::-webkit-scrollbar-thumb {
  background: rgba(203, 213, 224, 0.8);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.date-shifts-container::-webkit-scrollbar-thumb:hover {
  background: rgba(160, 174, 192, 0.9);
}

.date-shifts {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: stretch;
  padding: 4px 0;
}

.shift-indicator-simple {
  height: 2px;
  border-radius: 1px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 0.7rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 8px 0 8px 8px;
  margin-bottom: 1px;
  text-align: left;
  line-height: 1;
  position: relative;
  overflow: visible;
  background: var(--status-color, transparent);
  background: color-mix(in srgb, var(--status-color, #3b82f6) 15%, transparent);
  border-left: 3px solid var(--personal-color, #3b82f6);
}

.shift-indicator-simple .employee-name {
  flex: 1;
}

.shift-indicator-simple .status-icon {
  background: #f59e0b;
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  margin-left: 4px;
}

.shift-indicator-simple:hover {
  font-weight: 600;
  padding-left: 12px;
}

.shift-indicator-simple.selected {
  font-weight: 700;
  padding-left: 12px;
  color: #1f2937;
}

/* 부서별 기본 색상 */
.shift-hall {
  border-left-color: #6366f1;
}

.shift-kitchen {
  border-left-color: #059669;
}

.shift-default {
  border-left-color: #9ca3af;
}

/* 직급별 색상 구분 - 부서 색상에 투명도 적용 */
.shift-indicator-simple.position-part_time.shift-hall {
  border-left-color: rgba(99, 102, 241, 0.6);
}

.shift-indicator-simple.position-part_time.shift-kitchen {
  border-left-color: rgba(5, 150, 105, 0.6);
}

.shift-indicator-simple.position-part_time.shift-default {
  border-left-color: rgba(156, 163, 175, 0.6);
}

/* 상태별 스타일링 - 월간 뷰 */
.shift-indicator-simple.status-scheduled {
  background-color: rgba(59, 130, 246, 0.1);
  color: #1e40af;
}

.shift-indicator-simple.status-in_progress {
  background-color: rgba(16, 185, 129, 0.2);
  color: #047857;
  animation: pulse 2s ease-in-out infinite alternate;
  font-weight: 600;
}

.shift-indicator-simple.status-completed {
  background-color: rgba(107, 114, 128, 0.15);
  color: #6b7280;
  font-weight: 600;
  text-decoration: line-through;
  opacity: 0.8;
}

.shift-indicator-simple.status-canceled {
  display: none; /* 완전히 숨김 */
}

.shift-indicator-simple.status-missed {
  background-color: rgba(220, 38, 38, 0.15);
  color: #dc2626;
  font-weight: 600;
  text-decoration: line-through;
}

.shift-indicator-simple.status-review {
  background-color: rgba(220, 38, 38, 0.15);
  color: #dc2626;
  font-weight: 600;
  border: 2px dashed #dc2626;
}

.add-shift-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: #10b981;
  color: white;
  cursor: pointer;
  font-size: 0.7rem;
  opacity: 0.7;
  transition: all 0.2s;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-shift-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* 주간 뷰 스타일 */
.week-view {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.week-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.time-column {
  padding: 12px 8px;
  background: #f1f5f9;
  border-right: 1px solid #e5e7eb;
}

.week-day-header {
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.2s;
  border-right: 1px solid #e5e7eb;
}

.week-day-header:hover {
  background: #f0f9ff;
}

.week-day-header.today {
  background: #dbeafe;
}

.day-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #6b7280;
}

.day-date {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 4px 0;
}

.day-count {
  font-size: 0.8rem;
  color: #3b82f6;
}

.week-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  max-height: 600px;
  overflow-y: auto;
}

.week-grid .time-column {
  background: #f1f5f9;
  border-right: 1px solid #e5e7eb;
  padding: 0;
}

.time-slot {
  height: 60px;
  padding: 4px 8px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  align-items: flex-start;
}

.week-day-column {
  position: relative;
  border-right: 1px solid #e5e7eb;
}

.hour-slot {
  height: 60px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.2s;
}

.hour-slot:hover {
  background: #f8fafc;
}

.week-shift {
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  transition: transform 0.2s;
  font-size: 0.75rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--status-color, #3b82f6) 15%, transparent);
  border-left: 4px solid var(--personal-color, #3b82f6);
}

.week-shift .status-icon {
  background: #f59e0b;
  color: white;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: bold;
  margin-left: 4px;
  vertical-align: middle;
}

.week-shift:hover {
  transform: translateX(2px);
}

/* 주간 뷰 - 기본 정규직 색상 */
.week-shift.shift-hall {
  background: #6366f1;
  color: white;
}

.week-shift.shift-kitchen {
  background: #059669;
  color: white;
}

.week-shift.shift-default {
  background: #9ca3af;
  color: white;
}

/* 주간 뷰 - 아르바이트 색상 (밝은 색상) */
.week-shift.position-part_time.shift-hall {
  background: rgba(99, 102, 241, 0.7);
  color: white;
}

.week-shift.position-part_time.shift-kitchen {
  background: rgba(5, 150, 105, 0.7);
  color: white;
}

.week-shift.position-part_time.shift-default {
  background: rgba(156, 163, 175, 0.7);
  color: white;
}

/* 상태별 스타일링 - 주간 뷰 */
.week-shift.status-scheduled {
  border: 2px solid rgba(59, 130, 246, 0.5);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.2);
}

.week-shift.status-in_progress {
  border: 2px solid #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4), inset 0 0 0 1px rgba(16, 185, 129, 0.3);
  animation: pulse 2s ease-in-out infinite alternate;
  filter: brightness(1.1);
}

.week-shift.status-completed {
  border: 2px solid #6b7280;
  box-shadow: inset 0 0 0 1px rgba(107, 114, 128, 0.3);
  opacity: 0.8;
  position: relative;
  filter: grayscale(0.3);
}

.week-shift.status-completed::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #6b7280;
  transform: translateY(-50%);
  z-index: 1;
}

.week-shift.status-canceled {
  display: none; /* 완전히 숨김 */
}

.week-shift.status-missed {
  border: 2px solid #dc2626;
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.3);
  position: relative;
  opacity: 0.8;
}

.week-shift.status-missed::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #dc2626;
  transform: translateY(-50%);
  z-index: 1;
}

.week-shift.status-review {
  border: 2px dashed #dc2626;
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.3), inset 0 0 0 1px rgba(220, 38, 38, 0.2);
  background: rgba(220, 38, 38, 0.1);
  animation: blink 1.5s ease-in-out infinite alternate;
}

.shift-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shift-employee {
  font-weight: 600;
}

.shift-time {
  font-size: 0.7rem;
  opacity: 0.9;
}

.shift-cost {
  font-size: 0.65rem;
  font-weight: 500;
  opacity: 0.8;
  white-space: nowrap;
}

/* 기존 아래쪽 비용 표시 스타일 제거됨 - 이제 상단 우측에 표시 */

/* 태블릿 반응형 */
@media (max-width: 1024px) {
  .workshift-calendar {
    padding: 0 12px;
  }
  
  .calendar-header {
    padding: 16px 20px;
  }
  
  .date-cell {
    min-height: 120px;
    padding: 10px 8px;
  }
  
  .date-shifts-container {
    max-height: 65px;
    margin: 8px 0 4px 0;
  }
  
  .shift-indicator-simple {
    font-size: 0.65rem;
    padding: 6px 0 6px 6px;
  }
  
  .selected-shift-info {
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .selected-shift-details {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }
  
  .daily-cost-box {
    font-size: 0.55rem;
    max-width: 70px;
    padding: 2px 4px;
    font-weight: 700;
  }
  
  .nav-btn, .view-btn {
    padding: 8px 14px;
    font-size: 0.9rem;
  }
  
  .weekday {
    padding: 10px 6px;
    font-size: 0.85rem;
  }
}

/* 모바일 반응형 */
@media (max-width: 768px) {
  .workshift-calendar {
    padding: 0 8px;
  }
  
  .calendar-header {
    flex-direction: column;
    gap: 16px;
    padding: 16px 12px;
  }
  
  .nav-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .view-controls {
    width: 100%;
    justify-content: center;
  }
  
  .nav-btn {
    padding: 8px 12px;
    font-size: 0.85rem;
  }
  
  .current-month {
    font-size: 1.15rem;
  }
  
  .view-btn {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
  
  .date-cell {
    min-height: 105px;
    padding: 8px 6px;
    font-size: 0.85rem;
  }
  
  .date-number {
    font-size: 0.85rem;
  }
  
  .date-shifts-container {
    max-height: 55px;
    margin: 8px 0 4px 0;
  }
  
  .shift-indicator-simple {
    font-size: 0.6rem;
    padding: 6px 0 6px 6px;
  }
  
  .selected-shift-info {
    padding: 16px;
    margin-bottom: 18px;
  }
  
  .selected-shift-header h4 {
    font-size: 1.1rem;
  }
  
  .selected-shift-details {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .detail-item {
    padding: 6px 10px;
  }
  
  .daily-cost-box {
    font-size: 0.5rem;
    max-width: 65px;
    padding: 2px 4px;
    font-weight: 700;
  }
  
  .daily-cost-boxes {
    gap: 1px;
  }
  
  .week-grid {
    grid-template-columns: 60px repeat(7, 1fr);
  }
  
  .time-column {
    padding: 8px 4px;
  }
  
  .week-day-header {
    padding: 8px 4px;
  }
  
  .add-shift-btn {
    width: 20px;
    height: 20px;
    font-size: 0.65rem;
  }
}

/* 작은 모바일 */
@media (max-width: 480px) {
  .workshift-calendar {
    padding: 0 6px;
  }
  
  .calendar-header {
    padding: 12px;
    gap: 12px;
  }
  
  .date-cell {
    min-height: 90px;
    padding: 6px 4px;
  }
  
  .date-number {
    font-size: 0.8rem;
  }
  
  .date-shifts-container {
    max-height: 45px;
    margin: 6px 0 4px 0;
  }
  
  .shift-indicator-simple {
    font-size: 0.55rem;
    padding: 4px 0 4px 4px;
  }
  
  .daily-cost-box {
    font-size: 0.45rem;
    max-width: 55px;
    padding: 2px 3px;
    font-weight: 700;
  }
  
  .daily-cost-boxes {
    gap: 1px;
  }
  
  .current-month {
    font-size: 1rem;
    min-width: 100px;
  }
  
  .nav-btn {
    padding: 6px 10px;
    font-size: 0.8rem;
  }
  
  .view-btn {
    padding: 4px 10px;
    font-size: 0.8rem;
  }
  
  .weekday {
    padding: 8px 4px;
    font-size: 0.8rem;
  }
  
  .add-shift-btn {
    width: 18px;
    height: 18px;
    font-size: 0.6rem;
  }
}

/* 애니메이션 정의 */
@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>