<template>
  <div class="calendar-section card">
    <h3><AppIcon name="calendar" :size="20" class="inline-block mr-2" />이번 달 근무 캘린더</h3>
    <div class="calendar-header">
      <button @click="changeMonth(-1)" class="calendar-nav">◄</button>
      <span class="calendar-title">{{ calendarMonth }} {{ calendarYear }}</span>
      <button @click="changeMonth(1)" class="calendar-nav">►</button>
    </div>
    <div class="calendar-grid">
      <div class="calendar-day-header" v-for="day in ['일', '월', '화', '수', '목', '금', '토']" :key="day">
        {{ day }}
      </div>
      <div 
        v-for="day in calendarDays" 
        :key="day.date"
        :class="['calendar-day', {
          'worked': day.worked,
          'today': day.isToday,
          'other-month': !day.isCurrentMonth,
          'has-workshift': day.hasWorkshift,
          [`status-${day.workshiftInfo?.status?.toLowerCase()}`]: day.hasWorkshift
        }]"
        :title="day.hasWorkshift ? `${day.workshiftInfo.startTime} - ${day.workshiftInfo.endTime} (${day.workshiftInfo.hours}시간)` : ''"
      >
        <span class="day-number">{{ day.day }}</span>
        <div v-if="day.hasWorkshift && day.workshiftInfo" class="workshift-details">
          <div class="shift-time">{{ day.workshiftInfo.startTime }} - <br>{{ day.workshiftInfo.endTime }}</div>
          <div :class="['shift-status', `status-${day.workshiftInfo.status.toLowerCase()}`]">
            {{ getStatusText(day.workshiftInfo.status) }}
          </div>
        </div>
        <span v-if="day.worked && day.hours !== null" class="worked-hours">✓ {{ day.hours }}h</span>
        <span v-else-if="day.worked && day.hours === null" class="working-now">근무중</span>
      </div>
    </div>
    <div class="calendar-stats">
      <div class="stat-item">
        <span class="stat-label">총 근무일:</span>
        <span class="stat-value">{{ calendarStats.workDays }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">총 근무시간:</span>
        <span class="stat-value">{{ calendarStats.totalHours }}시간</span>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, watch } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'MonthlyCalendar',
  components: { AppIcon },
  props: {
    attendanceStore: {
      type: Object,
      required: true
    },
    calendarYear: {
      type: Number,
      required: true
    },
    calendarMonth: {
      type: Number,
      required: true
    }
  },
  setup(props) {
    const workshiftStore = useWorkshiftStore()
    
    // Load workshifts when component mounts or date changes
    const loadWorkshifts = async () => {
      await workshiftStore.fetchMyWorkshifts(props.calendarMonth, props.calendarYear)
    }
    
    onMounted(loadWorkshifts)
    watch(() => [props.calendarYear, props.calendarMonth], loadWorkshifts)
    
    return {
      workshiftStore
    }
  },
  computed: {
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
        const prevDate = new Date(this.calendarYear, this.calendarMonth - 2, prevMonthDays - i)
        // 로컬 시간대 기준으로 날짜 문자열 생성
        const year = prevDate.getFullYear()
        const month = String(prevDate.getMonth() + 1).padStart(2, '0')
        const day = String(prevDate.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        days.push({
          day: prevMonthDays - i,
          date: dateStr,
          isCurrentMonth: false,
          worked: false,
          hours: null,
          isToday: false
        })
      }
      
      // 현재 달
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(this.calendarYear, this.calendarMonth - 1, day)
        // 로컬 시간대 기준으로 날짜 문자열 생성 (시간대 차이 보정)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const dayStr = String(date.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${dayStr}`
        
        // Check attendance records
        const records = this.attendanceStore.getEmployeeRecordsByDate(dateStr)
        let hours = null
        let worked = false
        
        if (records.length > 0) {
          const record = records[0]
          
          // API에서 workedMinutes를 제공하면 우선 사용
          if (record.workedMinutes > 0) {
            worked = true
            hours = Math.round((record.workedMinutes / 60) * 10) / 10
          } 
          // 그렇지 않으면 clockInAt, clockOutAt으로 계산
          else if (record.clockInAt && record.clockOutAt) {
            worked = true
            const workMs = new Date(record.clockOutAt) - new Date(record.clockInAt)
            hours = Math.round(workMs / (1000 * 60 * 60) * 10) / 10
          }
          // 출근만 하고 퇴근하지 않은 경우
          else if (record.clockInAt && !record.clockOutAt) {
            worked = true
            hours = null // 근무 중 표시
          }
        }
        
        // Check workshift schedules (exclude CANCELED) - 한국시간 기준 비교
        const workshifts = this.workshiftStore.myWorkshifts.filter(shift => {
          const shiftDate = new Date(shift.startAt)
          const status = shift.status || 'SCHEDULED'
          return shiftDate.toDateString() === date.toDateString() && status !== 'CANCELED'
        })
        
        let hasWorkshift = workshifts.length > 0
        let workshiftInfo = null
        
        if (hasWorkshift) {
          const shift = workshifts[0] // Take first shift for the day
          const startTime = new Date(shift.startAt)
          const endTime = new Date(shift.endAt)
          const durationMs = endTime - startTime
          const workshiftHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10
          
          // Use backend status first, then calculate based on attendance like Admin calendar
          let actualStatus = shift.status || 'SCHEDULED'
          
          // If backend already set a specific status, use it (REVIEW, etc.)
          if (shift.status && ['REVIEW', 'COMPLETED', 'IN_PROGRESS', 'CANCELED'].includes(shift.status.toUpperCase())) {
            actualStatus = shift.status.toUpperCase()
          } else {
            // Calculate status based on attendance for SCHEDULED shifts
            if (date.toDateString() === today.toDateString()) {
              // Today: check if currently working
              if (records.length > 0 && records[0].clockInAt && !records[0].clockOutAt) {
                actualStatus = 'IN_PROGRESS'
              } else if (records.length > 0 && records[0].clockInAt && records[0].clockOutAt) {
                actualStatus = 'COMPLETED'
              } else {
                actualStatus = 'SCHEDULED'
              }
            } else if (date < today) {
              // Past dates: check if worked or missed
              if (records.length > 0 && (records[0].clockInAt || records[0].workedMinutes > 0)) {
                actualStatus = 'COMPLETED'
              } else {
                actualStatus = 'MISSED'
              }
            } else {
              // Future dates: keep scheduled
              actualStatus = 'SCHEDULED'
            }
          }
          
          workshiftInfo = {
            hours: workshiftHours,
            startTime: new Date(shift.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endTime: new Date(shift.endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            status: actualStatus,
            id: shift.id
          }
        }
        
        days.push({
          day,
          date: dateStr,
          isCurrentMonth: true,
          worked,
          hours,
          hasWorkshift,
          workshiftInfo,
          isToday: date.toDateString() === today.toDateString()
        })
      }
      
      // 다음 달의 처음 며칠
      const lastDayOfWeek = lastDay.getDay()
      if (lastDayOfWeek < 6) {
        for (let day = 1; day <= 6 - lastDayOfWeek; day++) {
          const nextDate = new Date(this.calendarYear, this.calendarMonth, day)
          // 로컬 시간대 기준으로 날짜 문자열 생성
          const year = nextDate.getFullYear()
          const month = String(nextDate.getMonth() + 1).padStart(2, '0')
          const dayStr = String(nextDate.getDate()).padStart(2, '0')
          const dateStr = `${year}-${month}-${dayStr}`
          
          days.push({
            day,
            date: dateStr,
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
      // Filter workshifts for current month with COMPLETED status only
      const completedWorkshifts = this.workshiftStore.myWorkshifts.filter(shift => {
        const shiftDate = new Date(shift.startAt)
        const status = shift.status || 'SCHEDULED'
        return shiftDate.getFullYear() === this.calendarYear &&
               shiftDate.getMonth() === this.calendarMonth - 1 &&
               status.toUpperCase() === 'COMPLETED'
      })
      
      let workDays = completedWorkshifts.length
      let totalHours = 0
      
      completedWorkshifts.forEach(shift => {
        // Calculate planned hours from shift duration
        const startTime = new Date(shift.startAt)
        const endTime = new Date(shift.endAt)
        const durationMs = endTime - startTime
        const plannedHours = durationMs / (1000 * 60 * 60)
        totalHours += plannedHours
        
        // If actual minutes are available, use them instead
        if (shift.actualMinutes && shift.actualMinutes > 0) {
          totalHours -= plannedHours // subtract planned
          totalHours += shift.actualMinutes / 60 // add actual
        } else if (shift.workedMinutes && shift.workedMinutes > 0) {
          totalHours -= plannedHours // subtract planned  
          totalHours += shift.workedMinutes / 60 // add actual
        }
      })
      
      return {
        workDays,
        totalHours: Math.round(totalHours * 10) / 10
      }
    }
  },
  methods: {
    changeMonth(delta) {
      this.$emit('change-month', delta)
    },
    getStatusText(status) {
      const statusTexts = {
        'SCHEDULED': '예정',
        'IN_PROGRESS': '근무중',
        'COMPLETED': '완료',
        'REVIEW': '검토필요',
        'CANCELED': '취소',
        'MISSED': '결근'
      }
      return statusTexts[status] || status
    }
  },
  emits: ['change-month']
}
</script>

<style scoped>
.calendar-section {
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.calendar-section h3 {
  margin-bottom: var(--space-5);
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.calendar-nav {
  background: none;
  border: none;
  font-size: var(--text-xl);
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-base);
  transition: all var(--transition-fast);
}

.calendar-nav:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
}

.calendar-title {
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  font-size: var(--text-lg);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.calendar-day-header {
  text-align: center;
  padding: var(--space-2);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-base);
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-primary);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.calendar-day:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.calendar-day.worked {
  background: var(--success-100);
  border-color: var(--success-400);
  color: var(--success-700);
}

.calendar-day.today {
  background: var(--primary-100);
  border-color: var(--primary-400);
  color: var(--primary-700);
  font-weight: var(--font-semibold);
}

.calendar-day.has-workshift {
  border-color: var(--warning-400);
  background: var(--warning-50);
}

.calendar-day.status-scheduled {
  border-color: var(--primary-400);
  background: var(--primary-50);
}

.calendar-day.status-review {
  border-color: var(--warning-400);
  background: var(--warning-50);
}

.calendar-day.status-canceled {
  border-color: var(--gray-400);
  background: var(--gray-50);
  opacity: 0.7;
}

.calendar-day.status-missed {
  border-color: var(--danger-400);
  background: var(--danger-50);
}

.calendar-day.status-in_progress {
  border-color: var(--success-400);
  background: var(--success-50);
  animation: pulse 2s ease-in-out infinite alternate;
}

.calendar-day.status-completed {
  border-color: var(--success-400);
  background: var(--success-100);
}

.calendar-day.other-month {
  background: var(--gray-100);
  color: var(--gray-500);
  opacity: 0.6;
}

.day-number {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.worked-hours {
  font-size: var(--text-xs);
  color: var(--success-600);
  font-weight: var(--font-semibold);
  margin-top: var(--space-1);
  font-family: var(--font-mono);
}

.working-now {
  font-size: var(--text-xs);
  color: var(--primary-600);
  font-weight: var(--font-semibold);
  margin-top: var(--space-1);
  font-family: var(--font-mono);
  animation: pulse 2s ease-in-out infinite alternate;
}

.workshift-indicator {
  margin-top: var(--space-1);
}

.workshift-details {
  margin-top: var(--space-1);
  text-align: center;
}

.shift-time {
  font-size: 10px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-weight: var(--font-medium);
  margin-bottom: 2px;
}

.shift-status {
  font-size: 10px;
  font-weight: var(--font-semibold);
  padding: 1px 3px;
  border-radius: 3px;
  text-transform: uppercase;
}

.shift-status.status-scheduled {
  background: var(--primary-100);
  color: var(--primary-700);
}

.shift-status.status-review {
  background: var(--warning-100);
  color: var(--warning-700);
}

.shift-status.status-canceled {
  background: var(--gray-100);
  color: var(--gray-700);
}

.shift-status.status-missed {
  background: var(--danger-100);
  color: var(--danger-700);
}

.shift-status.status-in_progress {
  background: var(--success-100);
  color: var(--success-700);
  animation: pulse 1s ease-in-out infinite alternate;
}

.shift-status.status-completed {
  background: var(--success-100);
  color: var(--success-700);
}

@keyframes pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

.calendar-stats {
  display: flex;
  gap: var(--space-6);
  justify-content: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.calendar-stats .stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  min-width: 120px;
}

.calendar-stats .stat-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.calendar-stats .stat-value {
  color: var(--color-text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  font-family: var(--font-mono);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .calendar-section {
    padding: var(--space-3);
    margin: var(--space-2);
    margin-bottom: var(--space-4);
    overflow-x: hidden;
  }
  
  .calendar-section h3 {
    font-size: var(--text-lg);
    text-align: center;
  }
  
  .calendar-header {
    margin-bottom: var(--space-3);
    gap: var(--space-2);
  }
  
  .calendar-nav {
    padding: var(--space-2);
    font-size: var(--text-lg);
  }
  
  .calendar-title {
    font-size: var(--text-lg);
    min-width: 140px;
    text-align: center;
  }
  
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
    min-width: 0;
    overflow-x: visible;
    width: 100%;
  }
  
  .calendar-day {
    padding: var(--space-1);
    min-height: 60px;
    min-width: 0;
    aspect-ratio: 1;
    font-size: var(--text-xs);
  }
  
  .calendar-day-header {
    padding: var(--space-1);
    font-size: var(--text-xs);
    min-width: 0;
  }
  
  .day-number {
    font-size: var(--text-sm);
  }
  
  .worked-hours, .working-now {
    font-size: 10px;
  }
  
  .workshift-details {
    min-width: 0;
  }
  
  .shift-time {
    font-size: 8px;
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
    max-height: 22px;
  }
  
  .shift-status {
    font-size: 7px;
    padding: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1;
    border-radius: 2px;
  }
  
  .calendar-stats {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .calendar-stats .stat-item {
    flex-direction: row;
    justify-content: space-between;
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .calendar-section {
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    margin-left: var(--space-2);
    margin-right: var(--space-2);
  }
  
  .calendar-section h3 {
    font-size: var(--text-base);
    margin-bottom: var(--space-3);
  }
  
  .calendar-header {
    margin-bottom: var(--space-3);
    gap: var(--space-1);
  }
  
  .calendar-nav {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-base);
    border-radius: var(--radius-sm);
  }
  
  .calendar-title {
    font-size: var(--text-base);
    min-width: 120px;
  }
  
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 1px;
    min-width: 0;
  }
  
  .calendar-day {
    padding: 2px;
    min-height: 50px;
    min-width: 0;
    font-size: 7px;
  }
  
  .calendar-day-header {
    padding: var(--space-1);
    font-size: 10px;
    min-width: 0;
  }
  
  .day-number {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    line-height: 1;
  }
  
  .worked-hours, .working-now {
    font-size: 8px;
    margin-top: 1px;
    line-height: 1;
  }
  
  .workshift-details {
    margin-top: 1px;
    min-width: 0;
  }
  
  .shift-time {
    font-size: 6px;
    margin-bottom: 1px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-height: 12px;
  }
  
  .shift-status {
    font-size: 6px;
    padding: 1px;
    border-radius: 1px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .calendar-stats {
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .calendar-stats .stat-item {
    flex-direction: row;
    justify-content: space-between;
    padding: var(--space-2);
  }
  
  .calendar-stats .stat-label {
    font-size: var(--text-xs);
  }
  
  .calendar-stats .stat-value {
    font-size: var(--text-base);
  }
}

@media (max-width: 360px) {
  .calendar-section {
    padding: var(--space-1);
    margin-bottom: var(--space-2);
    margin-left: var(--space-1);
    margin-right: var(--space-1);
  }
  
  .calendar-section h3 {
    font-size: var(--text-sm);
    margin-bottom: var(--space-2);
  }
  
  .calendar-header {
    margin-bottom: var(--space-2);
    gap: var(--space-1);
  }
  
  .calendar-nav {
    padding: 4px var(--space-1);
    font-size: var(--text-sm);
  }
  
  .calendar-title {
    font-size: var(--text-sm);
    min-width: 100px;
  }
  
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0px;
    min-width: 0;
  }
  
  .calendar-day {
    padding: 1px;
    min-height: 38px;
    min-width: 0;
    font-size: 6px;
    border-radius: 2px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  
  .calendar-day-header {
    padding: 2px 1px;
    font-size: 8px;
    min-width: 0;
  }
  
  .day-number {
    font-size: 8px;
    line-height: 1;
    margin-bottom: 1px;
  }
  
  .worked-hours, .working-now {
    font-size: 7px;
    margin-top: 0px;
    line-height: 1;
  }
  
  .workshift-details {
    margin-top: 0px;
    min-width: 0;
  }
  
  .shift-time {
    font-size: 6px;
    line-height: 1;
    margin-bottom: 0px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .shift-status {
    font-size: 5px;
    padding: 0px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .calendar-stats .stat-item {
    padding: var(--space-1);
  }
  
  .calendar-stats .stat-label {
    font-size: 10px;
  }
  
  .calendar-stats .stat-value {
    font-size: var(--text-sm);
  }
}
</style>