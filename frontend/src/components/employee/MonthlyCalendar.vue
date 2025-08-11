<template>
  <div class="calendar-section card">
    <h3>📅 이번 달 근무 캘린더</h3>
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
          'other-month': !day.isCurrentMonth
        }]"
      >
        <span class="day-number">{{ day.day }}</span>
        <span v-if="day.worked && day.hours !== null" class="worked-hours">{{ day.hours }}h</span>
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
export default {
  name: 'MonthlyCalendar',
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
      const records = this.attendanceStore.employeeRecords.filter(record => {
        const recordDate = new Date(record.date || record.clockInAt)
        return recordDate.getFullYear() === this.calendarYear &&
               recordDate.getMonth() === this.calendarMonth - 1
      })
      
      let workDays = 0
      let totalHours = 0
      
      records.forEach(record => {
        // API에서 workedMinutes를 제공하면 우선 사용
        if (record.workedMinutes > 0) {
          workDays++
          totalHours += record.workedMinutes / 60
        }
        // 그렇지 않으면 clockInAt, clockOutAt으로 계산
        else if (record.clockInAt && record.clockOutAt) {
          workDays++
          const workMs = new Date(record.clockOutAt) - new Date(record.clockInAt)
          totalHours += workMs / (1000 * 60 * 60)
        }
        // 출근만 한 경우도 근무일로 카운트 (현재 근무 중)
        else if (record.clockInAt && !record.clockOutAt) {
          workDays++
          // 근무 시간은 계산하지 않음 (아직 퇴근하지 않음)
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
  .calendar-grid {
    gap: 2px;
  }
  
  .calendar-day {
    padding: var(--space-1);
  }
  
  .calendar-day-header {
    padding: var(--space-1);
    font-size: var(--text-xs);
  }
  
  .day-number {
    font-size: var(--text-xs);
  }
  
  .worked-hours {
    font-size: 10px;
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
</style>