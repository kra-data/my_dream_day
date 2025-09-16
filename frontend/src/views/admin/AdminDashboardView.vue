<template>
  <div class="tab-content">
    <!-- 오늘 통계 - 컴팩트한 한 줄 레이아웃 -->
    <div class="stats-bar">
      <h2><AppIcon name="stats" :size="18" class="mr-2" /> 근무 현황</h2>
      <div class="stats-row">
        <div class="stat-item">
          <AppIcon name="users" :size="18" class="stat-icon" />
          <span class="stat-number">{{ attendanceStore.todaySummary.totalShifts }}</span>
          <span class="stat-label">전체</span>
        </div>
        <div class="stat-separator">|</div>
        <div class="stat-item success">
          <AppIcon name="success" :size="18" class="stat-icon" />
          <span class="stat-number">{{ attendanceStore.todaySummary.checkedIn }}</span>
          <span class="stat-label">출근</span>
        </div>
        <div class="stat-separator">|</div>
        <div class="stat-item warning">
          <AppIcon name="clock" :size="18" class="stat-icon" />
          <span class="stat-number">{{ attendanceStore.todaySummary.late }}</span>
          <span class="stat-label">지각</span>
        </div>
        <div class="stat-separator">|</div>
        <div class="stat-item error">
          <AppIcon name="error" :size="18" class="stat-icon" />
          <span class="stat-number">{{ attendanceStore.todaySummary.absent }}</span>
          <span class="stat-label">결근</span>
        </div>
      </div>
    </div>

    <div class="dashboard-content">
      <!-- 수동 출퇴근 관리 -->
      <div class="manual-attendance">
        <div class="manual-controls">
          <div v-if="employeesStore.employees.length === 0" class="no-data">
            등록된 직원이 없습니다
          </div>
          <div 
            v-else
            v-for="employee in employeesStore.employees" 
            :key="employee.id"
            class="employee-control-item"
          >
            <div class="employee-info">
              <div 
                class="employee-avatar" 
                :style="{ backgroundColor: employee.personalColor || getDefaultPersonalColor(employee.position) }"
              >
                {{ employee.name.charAt(0) }}
              </div>
              <div class="employee-details">
                <span class="employee-name">{{ employee.name }}</span>
                <span class="employee-dept">{{ formatSection(employee.section) }} · {{ formatPosition(employee.position) }}</span>
              </div>
            </div>
            
            <div class="attendance-controls">
              <div class="current-status">
                <StatusBadge :status="getEmployeeStatus(employee.id)" />
                <div class="status-time" v-if="getEmployeeWorkTime(employee.id)">
                  {{ getEmployeeWorkTime(employee.id) }}
                </div>
              </div>
              
              <div class="control-buttons">
                <button 
                  @click="manualCheckIn(employee)"
                  :disabled="isEmployeeWorking(employee.id) || attendanceStore.loading"
                  class="btn btn-success btn-sm"
                  :class="{ 'btn-loading': attendanceStore.loading && processingEmployeeId === employee.id }"
                >
                  <span v-if="attendanceStore.loading && processingEmployeeId === employee.id">처리중...</span>
                  <span v-else><AppIcon name="arrow-right" :size="16" class="mr-1" />출근</span>
                </button>
                
                <button 
                  @click="manualCheckOut(employee)"
                  :disabled="!isEmployeeWorking(employee.id) || attendanceStore.loading"
                  class="btn btn-warning btn-sm"
                  :class="{ 'btn-loading': attendanceStore.loading && processingEmployeeId === employee.id }"
                >
                  <span v-if="attendanceStore.loading && processingEmployeeId === employee.id">처리중...</span>
                  <span v-else><AppIcon name="arrow-left" :size="16" class="mr-1" />퇴근</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 최근 활동 -->
    <div class="recent-activity">
      <div class="activity-list">
        <div v-if="attendanceStore.recentActivities.length === 0" class="no-data">
          최근 출퇴근 활동이 없습니다
        </div>
        <div 
          v-else
          v-for="activity in attendanceStore.recentActivities" 
          :key="activity.id"
          class="activity-item"
        >
          <div class="activity-icon">
            <AppIcon :name="activity.type === 'IN' ? 'arrow-right' : 'arrow-left'" :size="20" />
          </div>
          <div class="activity-content">
            <div class="activity-text">
              <strong>{{ activity.name }}</strong>님이 
              <span :class="activity.type === 'IN' ? 'check-in' : 'check-out'">{{ activity.type === 'IN' ? '출근' : '퇴근' }}</span>
              했습니다
            </div>
            <div class="activity-time">{{ formatDateTime(activity.clockInAt || activity.clockOutAt) }}</div>
            <div v-if="activity.workedMinutes !== null" class="work-duration">
              근무시간: {{ formatWorkDuration(activity.workedMinutes) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import StatusBadge from '@/components/common/alarm/StatusBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { useAttendanceStore } from '@/stores/attendance'
import { useEmployeesStore } from '@/stores/employees'

export default {
  name: 'AdminDashboardView',
  components: {
    StatusBadge,
    AppIcon
  },
  setup() {
    const attendanceStore = useAttendanceStore()
    const employeesStore = useEmployeesStore()
    const processingEmployeeId = ref(null)
    
    return {
      attendanceStore,
      employeesStore,
      processingEmployeeId
    }
  },
  methods: {
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
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    },
    
    formatDateTime(timestamp) {
      return new Date(timestamp).toLocaleString('ko-KR', {
        hour12: false
      })
    },
    
    formatWorkDuration(workedMinutes) {
      if (workedMinutes === null || workedMinutes === undefined) return '-'
      
      const hours = Math.floor(workedMinutes / 60)
      const minutes = workedMinutes % 60
      
      return `${hours}시간 ${minutes}분`
    },

    getEmployeeStatus(employeeId) {
      const activeEmployee = this.attendanceStore.activeEmployees.find(emp => emp.employeeId === employeeId)
      return activeEmployee && activeEmployee.clockInAt ? 'working' : 'not-checked-in'
    },

    isEmployeeWorking(employeeId) {
      const activeEmployee = this.attendanceStore.activeEmployees.find(emp => emp.employeeId === employeeId)
      return activeEmployee && activeEmployee.clockInAt && !activeEmployee.clockOutAt
    },

    getEmployeeWorkTime(employeeId) {
      const activeEmployee = this.attendanceStore.activeEmployees.find(emp => emp.employeeId === employeeId)
      if (activeEmployee && activeEmployee.clockInAt) {
        return `출근: ${this.formatTime(activeEmployee.clockInAt)}`
      }
      return null
    },

    async manualCheckIn(employee) {
      if (this.isEmployeeWorking(employee.id)) {
        alert('이미 출근한 직원입니다.')
        return
      }

      if (!confirm(`${employee.name}님을 출근 처리하시겠습니까?`)) {
        return
      }

      this.processingEmployeeId = employee.id

      try {
        // store의 manualAttendance 함수 사용
        await this.attendanceStore.manualAttendance(employee.id, 'IN')
        alert(`${employee.name}님이 출근 처리되었습니다.`)
      } catch (error) {
        console.error('수동 출근 처리 실패:', error)
        alert(`출근 처리에 실패했습니다: ${error.message}`)
      } finally {
        this.processingEmployeeId = null
      }
    },

    async manualCheckOut(employee) {
      if (!this.isEmployeeWorking(employee.id)) {
        alert('출근하지 않은 직원입니다.')
        return
      }

      if (!confirm(`${employee.name}님을 퇴근 처리하시겠습니까?`)) {
        return
      }

      this.processingEmployeeId = employee.id

      try {
        // store의 manualAttendance 함수 사용
        await this.attendanceStore.manualAttendance(employee.id, 'OUT')
        alert(`${employee.name}님이 퇴근 처리되었습니다.`)
      } catch (error) {
        console.error('수동 퇴근 처리 실패:', error)
        alert(`퇴근 처리에 실패했습니다: ${error.message}`)
      } finally {
        this.processingEmployeeId = null
      }
    },

    getDefaultPersonalColor(position) {
      const positionColors = {
        'OWNER': '#8b5cf6',
        'MANAGER': '#06b6d4',
        'STAFF': '#10b981',
        'PART_TIME': '#f59e0b'
      }
      return positionColors[position] || '#3b82f6'
    }
  }
}
</script>

<style scoped src="@/assets/styles/views/admin/AdminDashboardView.css"></style>