<template>
  <div class="tab-content">
    <!-- 오늘 통계 - 컴팩트한 한 줄 레이아웃 -->
    <div class="stats-bar">
      <h2><AppIcon name="stats" :size="20" class="mr-2" /> 오늘의 근무 현황</h2>
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
        <h2><AppIcon name="user" :size="20" class="mr-2" />수동 출퇴근 관리</h2>
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
      <h2><AppIcon name="clipboard" :size="20" class="mr-2" />최근 출퇴근 활동</h2>
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
import StatusBadge from '@/components/StatusBadge.vue'
import AppIcon from '@/components/AppIcon.vue'
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

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 컴팩트한 통계 바 스타일 */
.stats-bar {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stats-bar h2 {
  margin-bottom: 16px;
  color: #1f2937;
  font-size: 1.25rem;
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f8fafc;
  transition: all 0.2s;
}

.stat-item:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
}

.stat-item .stat-icon {
  color: #6b7280;
}

.stat-item.success .stat-icon {
  color: #10b981;
}

.stat-item.warning .stat-icon {
  color: #f59e0b;
}

.stat-item.error .stat-icon {
  color: #ef4444;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 4px;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-separator {
  color: #d1d5db;
  font-weight: 300;
  font-size: 1.25rem;
}

/* 대시보드 콘텐츠 레이아웃 */
.dashboard-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.manual-attendance {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.manual-attendance h2 {
  margin-bottom: 20px;
  color: #1f2937;
}


.status-list {
  max-height: 400px;
  overflow-y: auto;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid white;
}

.employee-details {
  display: flex;
  flex-direction: column;
}

.employee-name {
  font-weight: 600;
  color: #1f2937;
}

.employee-dept {
  font-size: 0.9rem;
  color: #6b7280;
}

.status-info {
  text-align: right;
}

.time-info {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 4px;
}

.recent-activity {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.activity-list {
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
}

.activity-icon {
  font-size: 1.2rem;
  margin-top: 2px;
}

.activity-text .check-in {
  color: #10b981;
  font-weight: 600;
}

.activity-text .check-out {
  color: #f59e0b;
  font-weight: 600;
}

.activity-time {
  font-size: 0.8rem;
  color: #6b7280;
}

.work-duration {
  font-size: 0.8rem;
  color: #059669;
  font-weight: 500;
}

/* 수동 출퇴근 관리 스타일 */
.manual-controls {
  max-height: 400px;
  overflow-y: auto;
}

.employee-control-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 12px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: all 0.2s;
}

.employee-control-item:hover {
  background: #f1f5f9;
}

.attendance-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.current-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
}

.status-time {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

.control-buttons {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 0.875rem;
  white-space: nowrap;
  min-width: 0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-loading {
  position: relative;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

@media (max-width: 1024px) {
  .stats-row {
    gap: 16px;
  }
  
  .stat-item {
    padding: 6px 10px;
  }
  
  .stat-number {
    font-size: 1.25rem;
  }
}

@media (max-width: 768px) {
  .stats-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .stat-separator {
    display: none;
  }
  
  .stat-item {
    justify-content: center;
    padding: 12px 16px;
    border-radius: 8px;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .dashboard-content {
    gap: 20px;
    padding: 0 4px;
  }
  
  /* Mobile employee control improvements */
  .employee-control-item {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 16px 12px;
  }
  
  .employee-info {
    justify-self: flex-start;
  }
  
  .attendance-controls {
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }
  
  .current-status {
    flex-direction: row;
    justify-content: center;
    min-width: auto;
    gap: 12px;
    padding: 8px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 6px;
  }
  
  .control-buttons {
    justify-content: stretch;
    gap: 12px;
  }
  
  .control-buttons .btn {
    flex: 1;
    padding: 12px 16px;
    font-size: 0.9rem;
  }
}

/* Extra small mobile devices */
@media (max-width: 480px) {
  .stats-bar h2 {
    font-size: 1.2rem;
    text-align: center;
  }
  
  .stat-item {
    padding: 10px 12px;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
  
  .stat-label {
    font-size: 0.8rem;
  }
  
  .employee-control-item {
    padding: 12px 8px;
    margin-bottom: 8px;
  }
  
  .employee-name {
    font-size: 0.9rem;
  }
  
  .employee-dept {
    font-size: 0.75rem;
  }
  
  .control-buttons .btn {
    padding: 10px 12px;
    font-size: 0.85rem;
  }
  
  .activity-item {
    padding: 12px;
  }
  
  .activity-time {
    font-size: 0.75rem;
  }
  
  .activity-details span {
    font-size: 0.8rem;
  }
}
</style>