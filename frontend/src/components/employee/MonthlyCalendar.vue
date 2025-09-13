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

<style scoped src="@/assets/styles/employee/MonthlyCalendar.css"></style>
