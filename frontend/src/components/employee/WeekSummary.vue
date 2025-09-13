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

<style scoped src="@/assets/styles/employee/WeekSummary.css"></style>
