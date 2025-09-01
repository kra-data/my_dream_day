<template>
  <div class="workshift-calendar">
    <!-- 달력 헤더 -->
    <div class="calendar-header">
      <div class="nav-controls">
        <button @click="previousMonth" class="nav-btn" :disabled="loading">
          ◀️ 이전
        </button>
        <h3 class="current-month">{{ currentMonthLabel }}</h3>
        <button @click="nextMonth" class="nav-btn" :disabled="loading">
          다음 ▶️
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
          <div class="date-number">{{ date.date }}</div>
          
          <!-- 해당 날짜의 근무 일정들 -->
          <div v-if="date.isCurrentMonth" class="date-shifts">
            <div
              v-for="shift in getDateShifts(date).slice(0, 3)"
              :key="shift.id"
              :class="[
                'shift-indicator',
                `shift-${shift.employee?.section?.toLowerCase() || 'default'}`
              ]"
              @click.stop="handleShiftClick(shift)"
              :title="`${shift.employee?.name} - ${formatShiftTime(shift.startAt, shift.endAt)}`"
            >
              {{ shift.employee?.name?.charAt(0) || 'U' }}
            </div>
            <div 
              v-if="getDateShifts(date).length > 3" 
              class="more-shifts"
              :title="`+${getDateShifts(date).length - 3}개 더`"
            >
              +{{ getDateShifts(date).length - 3 }}
            </div>
          </div>
          
          <!-- 새 일정 추가 버튼 -->
          <button
            v-if="date.isCurrentMonth && !loading"
            @click.stop="handleCreateClick(date)"
            class="add-shift-btn"
            title="새 일정 추가"
          >
            ➕
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
            v-for="shift in getDateShifts(date)"
            :key="`week-shift-${shift.id}`"
            :class="[
              'week-shift',
              `shift-${shift.employee?.section?.toLowerCase() || 'default'}`
            ]"
            :style="getShiftStyle(shift)"
            @click="handleShiftClick(shift)"
            :title="`${shift.employee?.name} - ${formatShiftTime(shift.startAt, shift.endAt)}`"
          >
            <div class="shift-content">
              <div class="shift-employee">{{ shift.employee?.name }}</div>
              <div class="shift-time">{{ formatShiftTime(shift.startAt, shift.endAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'

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
    const currentView = ref('month')
    const currentDate = ref(new Date(props.selectedDate))
    
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
      const start = new Date(startAt)
      const end = new Date(endAt)
      
      const formatTime = (date) => {
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      
      return `${formatTime(start)} - ${formatTime(end)}`
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
        height: `${Math.max(duration, 30)}px`, // 최소 30px 높이
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
    
    // selectedDate prop이 변경되면 currentDate도 업데이트
    watch(() => props.selectedDate, (newDate) => {
      currentDate.value = new Date(newDate)
    })
    
    return {
      currentView,
      currentDate,
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
      handleHourClick
    }
  }
}
</script>

<style scoped>
.workshift-calendar {
  width: 100%;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 0;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 월간 뷰 스타일 */
.calendar-grid {
  background: white;
  border-radius: 8px;
  overflow: hidden;
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
  min-height: 120px;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  padding: 8px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
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
  background: #3b82f6;
  color: white;
}

.date-cell.has-shifts {
  background: #f0f9ff;
}

.date-cell.selected.has-shifts {
  background: #2563eb;
}

.date-number {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.date-shifts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 20px;
}

.shift-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

.shift-indicator:hover {
  transform: scale(1.1);
}

.shift-hall {
  background: #3b82f6;
}

.shift-kitchen {
  background: #10b981;
}

.shift-default {
  background: #6b7280;
}

.more-shifts {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 600;
  background: #e5e7eb;
  color: #6b7280;
}

.add-shift-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #10b981;
  color: white;
  cursor: pointer;
  font-size: 0.8rem;
  opacity: 0.7;
  transition: all 0.2s;
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
}

.week-shift:hover {
  transform: translateX(2px);
}

.week-shift.shift-hall {
  background: #3b82f6;
  color: white;
}

.week-shift.shift-kitchen {
  background: #10b981;
  color: white;
}

.week-shift.shift-default {
  background: #6b7280;
  color: white;
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

@media (max-width: 768px) {
  .calendar-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .date-cell {
    min-height: 80px;
    font-size: 0.8rem;
  }
  
  .shift-indicator {
    width: 20px;
    height: 20px;
    font-size: 0.6rem;
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
}
</style>