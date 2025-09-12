<template>
  <div class="week-summary card">
    <h3><AppIcon name="calendar" :size="20" class="inline-block mr-2" />이번 주 근무 현황</h3>
    <div class="week-grid">
      <div 
        v-for="day in weekSummary" 
        :key="day.date"
        :class="['day-item', `status-${day.status}`]"
        :title="day.workshiftInfo ? `${day.workshiftInfo.startTime} - ${day.workshiftInfo.endTime} (${day.workshiftInfo.plannedHours}시간 예정)` : ''"
      >
        <div class="day-name">{{ day.dayName }}</div>
        <div class="day-date">{{ day.dateStr }}</div>
        <div v-if="day.workshiftInfo" class="workshift-info">
          <div class="shift-time">{{ day.workshiftInfo.startTime }} - {{ day.workshiftInfo.endTime }}</div>
          <div class="planned-hours">{{ day.workshiftInfo.plannedHours }}h</div>
        </div>
        <div :class="['day-status', `status-${day.status}`]">{{ getStatusText(day.status) }}</div>
        <div class="day-hours">{{ day.hours || '-' }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'
import { useAttendanceStore } from '@/stores/attendance'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'WeekSummary',
  components: { AppIcon },
  setup() {
    const workshiftStore = useWorkshiftStore()
    const attendanceStore = useAttendanceStore()
    
    const loadWeekData = async () => {
      const today = new Date()
      // Fetch current month data
      await workshiftStore.fetchMyWorkshifts(
        today.getMonth() + 1, // month is 1-based
        today.getFullYear()
      )
    }
    
    onMounted(loadWeekData)
    
    const weekSummary = computed(() => {
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const today = new Date()
      const week = []
      
      const monday = new Date(today)
      monday.setDate(today.getDate() - today.getDay() + 1)
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        
        // 한국 시간대 기준으로 날짜 문자열 생성
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        // Check workshift for this day (exclude CANCELED)
        // UTC 시간은 브라우저가 자동으로 로칼시간으로 변환
        const workshifts = workshiftStore.myWorkshifts.filter(shift => {
          const shiftDate = new Date(shift.startAt)
          const status = shift.status || 'SCHEDULED'
          return shiftDate.toDateString() === date.toDateString() && status !== 'CANCELED'
        })
        
        // Check attendance for this day
        const records = attendanceStore.getEmployeeRecordsByDate(dateStr)
        
        let status = 'none'
        let hours = null
        let workshiftInfo = null
        
        if (workshifts.length > 0) {
          const shift = workshifts[0]
          const startTime = new Date(shift.startAt)
          const endTime = new Date(shift.endAt)
          const durationMs = endTime - startTime
          const plannedHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10
          
          workshiftInfo = {
            startTime: new Date(shift.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endTime: new Date(shift.endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            plannedHours: plannedHours,
            status: shift.status || 'SCHEDULED'
          }
          
          // Use proper backend status values, not custom ones
          const backendStatus = shift.status || 'SCHEDULED'
          status = backendStatus.toLowerCase()
        }
        
        // Apply proper status logic based on backend values and attendance
        if (workshifts.length > 0) {
          const shift = workshifts[0]
          const backendStatus = shift.status || 'SCHEDULED'
          
          // If backend already set specific status, use it
          if (['REVIEW', 'COMPLETED', 'IN_PROGRESS', 'CANCELED'].includes(backendStatus.toUpperCase())) {
            status = backendStatus.toLowerCase()
          } else {
            // Calculate status based on attendance for SCHEDULED shifts
            if (date.toDateString() === today.toDateString()) {
              if (attendanceStore.currentStatus.clockInAt && !attendanceStore.currentStatus.clockOutAt) {
                status = 'in_progress'
                const workedMinutes = attendanceStore.currentStatus.workedMinutes || 0
                hours = Math.round(workedMinutes / 60 * 10) / 10 + 'h'
              } else if (attendanceStore.currentStatus.clockInAt && attendanceStore.currentStatus.clockOutAt) {
                status = 'completed'
                const workedMinutes = attendanceStore.currentStatus.workedMinutes || 0
                hours = Math.round(workedMinutes / 60 * 10) / 10 + 'h'
              } else {
                status = 'scheduled'
              }
            } else if (date < today) {
              if (records.length > 0) {
                const record = records[0]
                if (record.workedMinutes > 0 || (record.clockInAt && record.clockOutAt)) {
                  status = 'completed'
                  hours = record.workedMinutes 
                    ? Math.round((record.workedMinutes / 60) * 10) / 10 + 'h'
                    : Math.round((new Date(record.clockOutAt) - new Date(record.clockInAt)) / (1000 * 60 * 60) * 10) / 10 + 'h'
                }
              } else {
                status = 'missed'
              }
            } else {
              // Future dates: keep scheduled
              status = 'scheduled'
            }
          }
        } else if (date < today && records.length > 0) {
          // No workshift but has attendance record (manual clock-in)
          const record = records[0]
          if (record.workedMinutes > 0 || (record.clockInAt && record.clockOutAt)) {
            status = 'worked'
            hours = record.workedMinutes 
              ? Math.round((record.workedMinutes / 60) * 10) / 10 + 'h'
              : Math.round((new Date(record.clockOutAt) - new Date(record.clockInAt)) / (1000 * 60 * 60) * 10) / 10 + 'h'
          }
        }
        
        week.push({
          date: dateStr,
          dayName: days[date.getDay()],
          dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
          status,
          hours,
          workshiftInfo,
          isToday: date.toDateString() === today.toDateString()
        })
      }
      
      return week
    })
    
    const getStatusText = (status) => {
      const statusTexts = {
        'scheduled': '예정',
        'in_progress': '근무중',
        'completed': '완료',
        'review': '검토필요',
        'canceled': '취소',
        'missed': '결근',
        'worked': '출근',
        'none': '-'
      }
      return statusTexts[status] || status
    }
    
    return {
      weekSummary,
      getStatusText
    }
  }
}
</script>

<style scoped>
.week-summary {
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  border-radius: var(--radius-xl);
}

.week-summary h3 {
  margin-bottom: var(--space-5);
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.day-item {
  text-align: center;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-primary);
  transition: all var(--transition-fast);
}

.day-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.day-item.status-scheduled {
  background: var(--primary-100);
  border-color: var(--primary-400);
  color: var(--primary-700);
}

.day-item.status-review {
  background: var(--warning-100);
  border-color: var(--warning-400);
  color: var(--warning-700);
}

.day-item.status-canceled {
  background: var(--gray-100);
  border-color: var(--gray-400);
  color: var(--gray-700);
  opacity: 0.7;
}

.day-item.status-in_progress {
  background: var(--success-100);
  border-color: var(--success-400);
  color: var(--success-700);
  animation: pulse 2s ease-in-out infinite alternate;
}

.day-item.status-completed {
  background: var(--success-100);
  border-color: var(--success-400);
  color: var(--success-700);
}

.day-item.status-worked {
  background: var(--success-100);
  border-color: var(--success-400);
  color: var(--success-700);
}

.day-item.status-missed {
  background: var(--danger-100);
  border-color: var(--danger-400);
  color: var(--danger-700);
}

.day-item.status-none {
  background: var(--gray-100);
  color: var(--gray-500);
}

.day-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}

.day-date {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}

.workshift-info {
  margin: var(--space-1) 0;
  text-align: center;
}

.shift-time {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-weight: var(--font-medium);
}

.planned-hours {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.day-status {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  text-align: center;
  margin: var(--space-1) 0;
}

.day-status.status-scheduled {
  background: var(--primary-200);
  color: var(--primary-800);
}

.day-status.status-review {
  background: var(--warning-200);
  color: var(--warning-800);
}

.day-status.status-canceled {
  background: var(--gray-200);
  color: var(--gray-800);
}

.day-status.status-in_progress {
  background: var(--success-200);
  color: var(--success-800);
}

.day-status.status-completed {
  background: var(--success-200);
  color: var(--success-800);
}

.day-status.status-worked {
  background: var(--success-200);
  color: var(--success-800);
}

.day-status.status-missed {
  background: var(--danger-200);
  color: var(--danger-800);
}

.day-status.status-none {
  background: var(--gray-200);
  color: var(--gray-600);
}

.day-hours {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  font-family: var(--font-mono);
}

@keyframes pulse {
  from { opacity: 1; }
  to { opacity: 0.6; }
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .week-summary {
    padding: var(--space-4);
    margin-bottom: var(--space-4);
    overflow-x: hidden;
  }
  
  .week-summary h3 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-4);
    text-align: center;
  }
  
  .week-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-1);
    min-width: 0;
    overflow-x: visible;
  }
  
  .day-item {
    padding: var(--space-2) var(--space-1);
    min-height: 100px;
    min-width: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  
  .day-name, 
  .day-date {
    font-size: var(--text-xs);
    line-height: 1.2;
  }
  
  .day-hours {
    font-size: var(--text-xs);
  }
  
  .workshift-info {
    margin: var(--space-1) 0;
    min-width: 0;
  }
  
  .shift-time {
    font-size: 9px;
    line-height: 1.2;
    word-break: break-all;
    hyphens: auto;
  }
  
  .planned-hours {
    font-size: var(--text-xs);
  }
  
  .day-status {
    font-size: 9px;
    padding: 1px 2px;
    word-break: break-all;
  }
}

@media (max-width: 480px) {
  .week-summary {
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    margin-left: var(--space-2);
    margin-right: var(--space-2);
  }
  
  .week-summary h3 {
    font-size: var(--text-base);
    margin-bottom: var(--space-3);
  }
  
  .week-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 1px;
    min-width: 0;
  }
  
  .day-item {
    padding: var(--space-1) 1px;
    min-height: 85px;
    min-width: 0;
    border-radius: var(--radius-sm);
    font-size: 8px;
  }
  
  .day-name {
    font-size: 9px;
    font-weight: var(--font-bold);
    line-height: 1;
  }
  
  .day-date {
    font-size: 8px;
    margin-bottom: 1px;
    line-height: 1;
  }
  
  .workshift-info {
    margin: 1px 0;
    min-width: 0;
  }
  
  .shift-time {
    font-size: 7px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  
  .planned-hours {
    font-size: 7px;
    font-weight: var(--font-bold);
    line-height: 1;
  }
  
  .day-status {
    font-size: 7px;
    padding: 1px;
    border-radius: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
  }
  
  .day-hours {
    font-size: 8px;
    font-weight: var(--font-bold);
    line-height: 1;
  }
}

@media (max-width: 360px) {
  .week-summary {
    padding: var(--space-1);
    margin-bottom: var(--space-2);
    margin-left: var(--space-1);
    margin-right: var(--space-1);
  }
  
  .week-summary h3 {
    font-size: var(--text-sm);
    margin-bottom: var(--space-2);
  }
  
  .week-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0px;
    min-width: 0;
  }
  
  .day-item {
    padding: 2px 1px;
    min-height: 70px;
    min-width: 0;
    font-size: 7px;
    border-radius: 2px;
  }
  
  .day-name {
    font-size: 8px;
    font-weight: var(--font-bold);
    line-height: 1;
  }
  
  .day-date {
    font-size: 7px;
    line-height: 1;
    margin-bottom: 1px;
  }
  
  .workshift-info {
    margin: 0px;
    min-width: 0;
  }
  
  .shift-time {
    font-size: 6px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .planned-hours {
    font-size: 6px;
    line-height: 1;
  }
  
  .day-status {
    font-size: 6px;
    padding: 0px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .day-hours {
    font-size: 7px;
    line-height: 1;
  }
}
</style>